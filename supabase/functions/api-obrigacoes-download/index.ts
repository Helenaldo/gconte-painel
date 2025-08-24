import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface AuthUser {
  id: string;
  email: string;
  nome: string;
  role: string;
}

async function validateBasicAuth(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }

  const credentials = atob(authHeader.replace('Basic ', ''));
  const [email, password] = credentials.split(':');

  if (!email || !password) {
    return null;
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Authenticate with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return null;
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (!profile) {
    return null;
  }

  return {
    id: authData.user.id,
    email: authData.user.email || '',
    nome: profile.nome,
    role: profile.role
  };
}

async function logAuditAction(supabase: any, userId: string, action: string, documentId?: string, details?: any) {
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
    const user = await validateBasicAuth(authHeader);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Valid email/password required via Basic Auth' }), 
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

    // Get document metadata and validate user access
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
    });

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