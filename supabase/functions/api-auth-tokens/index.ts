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
  email?: string;
}

async function validateSessionAuth(authHeader: string | null): Promise<AuthUser | null> {
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
      .select('role, email')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'administrador') {
      return null;
    }

    return { id: user.id, role: profile.role, email: profile.email };
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
    const user = await validateSessionAuth(authHeader);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Administrator session required' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse query parameters
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '20')));
    const search = url.searchParams.get('q') || '';
    const status = url.searchParams.get('status') || '';
    const orderBy = url.searchParams.get('order_by') || 'created_at';
    const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';

    const offset = (page - 1) * perPage;
    const tenant = user.email?.split('@')[1] || 'default';

    // Build query
    let query = supabase
      .from('access_tokens')
      .select(`
        id,
        jti,
        nome,
        scopes,
        expires_at,
        created_at,
        last_used_at,
        status,
        tenant
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .eq('tenant', tenant);

    // Apply filters
    if (search) {
      query = query.ilike('nome', `%${search}%`);
    }

    if (status && ['active', 'revoked'].includes(status)) {
      query = query.eq('status', status);
    }

    // Apply ordering and pagination
    query = query
      .order(orderBy, { ascending: order === 'asc' })
      .range(offset, offset + perPage - 1);

    const { data: tokens, error: dbError, count } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tokens' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format tokens for response
    const formattedTokens = tokens?.map(token => ({
      id: token.id,
      jti: token.jti,
      nome: token.nome,
      scopes: token.scopes,
      expires_at: token.expires_at,
      created_at: token.created_at,
      last_used_at: token.last_used_at,
      status: token.status,
      expired: new Date(token.expires_at) < new Date()
    })) || [];

    // Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / perPage);

    return new Response(JSON.stringify({
      data: formattedTokens,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});