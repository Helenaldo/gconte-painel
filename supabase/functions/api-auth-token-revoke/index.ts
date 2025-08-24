import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
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

async function logAuditAction(supabase: any, tokenJti: string, userId: string, action: string, details?: any, ip?: string, userAgent?: string) {
  await supabase
    .from('token_audit_log')
    .insert({
      token_jti: tokenJti,
      user_id: userId,
      action,
      details,
      ip_address: ip,
      user_agent: userAgent,
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
        JSON.stringify({ error: 'Unauthorized - Administrator session required' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JTI from URL
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const jti = pathSegments[pathSegments.length - 1];

    if (!jti) {
      return new Response(
        JSON.stringify({ error: 'Token JTI is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const tenant = user.email?.split('@')[1] || 'default';

    // Check if token exists and belongs to user
    const { data: existingToken, error: fetchError } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('jti', jti)
      .eq('user_id', user.id)
      .eq('tenant', tenant)
      .single();

    if (fetchError || !existingToken) {
      return new Response(
        JSON.stringify({ error: 'Token not found or access denied' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingToken.status === 'revoked') {
      return new Response(
        JSON.stringify({ error: 'Token is already revoked' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Revoke token (soft delete)
    const { error: updateError } = await supabase
      .from('access_tokens')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('jti', jti)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to revoke token' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit action
    await logAuditAction(
      supabase, 
      jti, 
      user.id, 
      'revoked', 
      { nome: existingToken.nome, scopes: existingToken.scopes },
      req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown',
      req.headers.get('user-agent') || 'unknown'
    );

    return new Response(JSON.stringify({
      revoked: true,
      jti,
      revoked_at: new Date().toISOString()
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