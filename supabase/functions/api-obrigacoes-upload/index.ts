import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AuthUser {
  id: string;
  email: string;
  nome: string;
  role: string;
}

async function validateSessionAuth(authHeader: string | null): Promise<AuthUser | null> {
  console.log('Authorization header:', authHeader);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Invalid authorization header format');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('Token extracted:', token ? 'Token present' : 'No token');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  // Validate session token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  console.log('Auth validation result:', { user: user ? 'User found' : 'No user', error: authError });

  if (authError || !user) {
    console.log('Auth error:', authError);
    return null;
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  console.log('Profile query result:', { profile: profile ? 'Profile found' : 'No profile', error: profileError });

  if (!profile) {
    console.log('No profile found for user:', user.id);
    return null;
  }

  console.log('User validated successfully:', user.id);
  
  return {
    id: user.id,
    email: user.email || '',
    nome: profile.nome,
    role: profile.role
  };
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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const user = await validateSessionAuth(authHeader);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Valid session token required' }), 
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

    // Generate file path with user-specific directory
    const fileName = `${crypto.randomUUID()}_${pdfFile.name}`;
    const filePath = `${user.id}/${fileName}`;
    
    // Upload to storage with user segregation
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