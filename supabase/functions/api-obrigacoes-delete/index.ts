import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
};

interface AuthUser {
  id: string;
  email: string;
  nome: string;
  role: string;
}

async function validateSessionAuth(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  // Validate session token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return null;
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return null;
  }

  return {
    id: user.id,
    email: user.email || '',
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

  if (req.method !== 'DELETE') {
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

    // Extract document ID from URL
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const documentId = pathSegments[pathSegments.length - 1];

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

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from('obligations-documents')
      .remove([document.file_url]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete document record from database
    const { error: deleteError } = await supabase
      .from('obligations_documents')
      .delete()
      .eq('id', documentId)
      .eq('uploaded_by', user.id);

    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete document' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit action
    await logAuditAction(supabase, user.id, 'delete', document.id, {
      file_name: document.file_name,
      file_size: document.file_size,
      deleted_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        message: 'Document deleted successfully',
        id: documentId 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});