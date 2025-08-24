import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from "https://deno.land/std@0.182.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AuthUser {
  id: string;
  role?: string;
  tenant?: string;
  scopes?: string[];
}

// JWT utility functions
async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Decode payload
    const payloadPadded = payloadB64.replace(/-/g, '+').replace(/_/g, '/').padEnd(payloadB64.length + (4 - payloadB64.length % 4) % 4, '=');
    const payload = JSON.parse(new TextDecoder().decode(decode(payloadPadded)));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    // Verify signature
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
    // Verify JWT signature and expiration
    const payload = await verifyJWT(token, jwtSecret);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if token exists in database and is not revoked
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

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return null;
    }

    // Check required scopes
    const userScopes = payload.scopes || [];
    const hasRequiredScopes = requiredScopes.every(scope => userScopes.includes(scope) || userScopes.includes('admin'));
    
    if (!hasRequiredScopes) {
      return null;
    }

    // Check role for admin endpoints
    if (requiredScopes.includes('obrigacoes.write') || requiredScopes.includes('obrigacoes.delete')) {
      if (payload.role !== 'admin') {
        return null;
      }
    }

    // Update last used timestamp (fire and forget)
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

async function calculateSHA256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkDuplicate(supabase: any, checksum: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('obligations_documents')
    .select('id')
    .eq('checksum', checksum)
    .eq('uploaded_by', userId)
    .maybeSingle();
  
  return !!data;
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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const user = await validateBearerAuth(authHeader, ['obrigacoes.write']);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Bearer token with obrigacoes.write scope and admin role required' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check idempotency key
    const idempotencyKey = req.headers.get('Idempotency-Key');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('obligations_documents')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .eq('uploaded_by', user.id)
        .maybeSingle();
      
      if (existing) {
        return new Response(
          JSON.stringify({
            id: existing.id,
            titulo: existing.title,
            url_download: `/api/obrigacoes/${existing.id}/download`,
            tamanho_bytes: existing.file_size,
            mime: existing.mime_type,
            criado_em: existing.created_at
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be multipart/form-data' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const titulo = formData.get('titulo') as string || '';
    const descricao = formData.get('descricao') as string || '';

    if (!pdfFile) {
      return new Response(
        JSON.stringify({ error: 'PDF file is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate MIME type
    if (pdfFile.type !== 'application/pdf') {
      return new Response(
        JSON.stringify({ error: 'File must be a PDF (application/pdf)' }), 
        { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (pdfFile.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 20MB limit' }), 
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate checksum
    const fileBuffer = await pdfFile.arrayBuffer();
    const checksum = await calculateSHA256(new Uint8Array(fileBuffer));

    // Check for duplicates
    if (await checkDuplicate(supabase, checksum, user.id)) {
      return new Response(
        JSON.stringify({ error: 'Duplicate file already exists' }), 
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate file path with tenant-specific directory
    const fileName = `${crypto.randomUUID()}_${pdfFile.name}`;
    const filePath = `${user.tenant}/${fileName}`;
    
    // Upload to storage with tenant segregation
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('obligations-documents')
      .upload(filePath, fileBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert metadata
    const { data: document, error: dbError } = await supabase
      .from('obligations_documents')
      .insert({
        title: titulo || pdfFile.name,
        description: descricao || null,
        file_url: uploadData.path,
        file_name: pdfFile.name,
        file_size: pdfFile.size,
        mime_type: pdfFile.type,
        uploaded_by: user.id,
        checksum,
        idempotency_key: idempotencyKey
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Cleanup uploaded file
      await supabase.storage.from('obligations-documents').remove([filePath]);
      return new Response(
        JSON.stringify({ error: 'Failed to save document metadata' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit action
    await logAuditAction(supabase, user.id, 'upload', document.id, {
      file_name: pdfFile.name,
      file_size: pdfFile.size,
      checksum
    });

    return new Response(
      JSON.stringify({
        id: document.id,
        titulo: document.title,
        url_download: `/api/obrigacoes/${document.id}/download`,
        tamanho_bytes: document.file_size,
        mime: document.mime_type,
        criado_em: document.created_at
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});