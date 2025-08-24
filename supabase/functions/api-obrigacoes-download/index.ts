import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from "https://deno.land/std@0.182.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface AuthUser {
  id: string;
  role?: string;
  tenant?: string;
  scopes?: string[];
}

// JWT utility functions (same as in other functions)
async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    
    const payloadPadded = payloadB64.replace(/-/g, '+').replace(/_/g, '/').padEnd(payloadB64.length + (4 - payloadB64.length % 4) % 4, '=');
    const payload = JSON.parse(new TextDecoder().decode(decode(payloadPadded)));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    const message = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signaturePadded = signatureB64.replace(/-/g, '+').replace(/_/g, '/').padEnd(signatureB64.length + (4 - signatureB64.length % 4) % 4, '=');
    const signature = decode(signaturePadded);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(message)
    );

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    return payload;
  } catch (error) {
    throw new Error(`JWT verification failed: ${error.message}`);
  }
}

async function hashToken(token: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function validateBearerAuth(authHeader: string | null, requiredScopes: string[]): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  const jwtSecret = Deno.env.get('JWT_SECRET');
  if (!jwtSecret) {
    return null;
  }

  try {
    const payload = await verifyJWT(token, jwtSecret);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const tokenHash = await hashToken(token);
    const { data: tokenRecord, error: dbError } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('jti', payload.jti)
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .single();

    if (dbError || !tokenRecord) {
      return null;
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return null;
    }

    const userScopes = payload.scopes || [];
    const hasRequiredScopes = requiredScopes.every(scope => userScopes.includes(scope) || userScopes.includes('admin'));
    
    if (!hasRequiredScopes) {
      return null;
    }

    supabase
      .from('access_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('jti', payload.jti)
      .then(() => {});

    return { 
      id: payload.sub, 
      role: payload.role,
      tenant: payload.tenant,
      scopes: userScopes
    };
  } catch (error) {
    console.error('JWT validation error:', error);
    return null;
  }
}

async function logAuditAction(supabase: any, userId: string, action: string, documentId?: string, details?: any, ip?: string, userAgent?: string) {
  await supabase
    .from('obligations_audit_log')
    .insert({
      user_id: userId,
      action,
      document_id: documentId,
      details,
      created_at: new Date().toISOString()
    });
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const user = await validateBearerAuth(authHeader, ['obrigacoes.read']);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Bearer token with obrigacoes.read scope required' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract document ID from URL
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const documentId = pathSegments[pathSegments.length - 2]; // Before '/download'

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get document metadata and validate tenant access
    const { data: document, error: dbError } = await supabase
      .from('obligations_documents')
      .select('*')
      .eq('id', documentId)
      .eq('uploaded_by', user.id) // Ensure same user uploaded it
      .single();

    if (dbError || !document) {
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('obligations-documents')
      .download(document.file_url);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download file' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit action
    await logAuditAction(supabase, user.id, 'download', document.id, {
      file_name: document.file_name,
      file_size: document.file_size,
      ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown'
    }, req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown', req.headers.get('user-agent') || 'unknown');

    // Return file with appropriate headers
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': document.mime_type,
        'Content-Length': document.file_size.toString(),
        'Content-Disposition': `attachment; filename="${document.file_name}"`,
        'Cache-Control': 'private, max-age=3600',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});