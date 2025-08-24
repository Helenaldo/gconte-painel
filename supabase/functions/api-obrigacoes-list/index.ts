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

async function validateSessionAuth(authHeader: string | null): Promise<AuthUser | null> {
  // Check if auth header exists
  if (!authHeader) {
    return null;
  }

  // Check if it starts with Bearer
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Check if token exists after Bearer
  if (!token || token.trim() === '') {
    return null;
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  // Validate session token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return null;
  }

  // Get user profile with service role to avoid RLS issues
  const supabaseService = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: profile } = await supabaseService
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

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
    const user = await validateSessionAuth(authHeader);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Valid session token required' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const searchParams = url.searchParams;
    
    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '20')));
    const query = searchParams.get('q') || '';
    const dataIni = searchParams.get('data_ini');
    const dataFim = searchParams.get('data_fim');
    const orderBy = searchParams.get('order_by') || 'created_at';
    const orderDir = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Build query for all documents with user name (any user can see any document)
    let queryBuilder = supabase
      .from('obligations_documents')
      .select(`
        id,
        title,
        description,
        file_name,
        file_size,
        mime_type,
        uploaded_at,
        created_at,
        uploaded_by,
        profiles:uploaded_by(nome)
      `, { count: 'exact' });

    // Apply text search filter
    if (query) {
      queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%,file_name.ilike.%${query}%`);
    }

    // Apply date filters
    if (dataIni) {
      queryBuilder = queryBuilder.gte('uploaded_at', dataIni);
    }
    if (dataFim) {
      queryBuilder = queryBuilder.lte('uploaded_at', dataFim);
    }

    // Apply ordering
    const validOrderFields = ['created_at', 'uploaded_at', 'title', 'file_size'];
    const safeOrderBy = validOrderFields.includes(orderBy) ? orderBy : 'created_at';
    queryBuilder = queryBuilder.order(safeOrderBy, { ascending: orderDir === 'asc' });

    // Apply pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    queryBuilder = queryBuilder.range(from, to);

    const { data: documents, error, count } = await queryBuilder;

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch documents' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response
    const formattedDocuments = documents?.map(doc => ({
      id: doc.id,
      titulo: doc.title,
      descricao: doc.description,
      arquivo_nome: doc.file_name,
      tamanho_bytes: doc.file_size,
      mime: doc.mime_type,
      url_download: `/api/obrigacoes/${doc.id}/download`,
      enviado_em: doc.uploaded_at,
      criado_em: doc.created_at,
      enviado_por: doc.profiles?.nome || 'Usuário não encontrado'
    })) || [];

    const totalPages = Math.ceil((count || 0) / perPage);

    return new Response(
      JSON.stringify({
        data: formattedDocuments,
        pagination: {
          page,
          per_page: perPage,
          total: count || 0,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        filters: {
          q: query,
          data_ini: dataIni,
          data_fim: dataFim,
          order_by: safeOrderBy,
          order: orderDir
        }
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