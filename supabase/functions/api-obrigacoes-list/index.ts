import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface AuthUser {
  id: string;
  role?: string;
}

async function validateAdminAuth(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'administrador') {
      return null;
    }

    return { id: user.id, role: profile.role };
  } catch {
    return null;
  }
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
    const user = await validateAdminAuth(authHeader);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Administrator access required' }), 
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

    // Build query
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
        profiles!obligations_documents_uploaded_by_fkey(nome)
      `, { count: 'exact' })
      .eq('uploaded_by', user.id); // Filter by tenant (user)

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
      enviado_por: doc.profiles?.nome
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