import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode, decode } from "https://deno.land/std@0.182.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
};

interface AuthUser {
  id: string;
  role?: string;
  email?: string;
}

// JWT utility functions
async function createJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encodedHeader = encode(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = encode(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const message = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const encodedSignature = encode(new Uint8Array(signature)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${message}.${encodedSignature}`;
}

async function hashToken(token: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

  if (req.method !== 'PATCH') {
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
    const jti = pathSegments[pathSegments.length - 2]; // ../{jti}/rotate

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
        JSON.stringify({ error: 'Cannot rotate a revoked token' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(existingToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Cannot rotate an expired token' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new token with same properties but new JTI and extended expiration
    const now = Math.floor(Date.now() / 1000);
    const originalExpiration = new Date(existingToken.expires_at);
    const originalCreation = new Date(existingToken.created_at);
    const originalDuration = (originalExpiration.getTime() - originalCreation.getTime()) / 1000; // duration in seconds
    const exp = now + originalDuration; // Same duration as original token

    const newJti = crypto.randomUUID();

    const payload = {
      sub: user.id,
      role: existingToken.role,
      tenant: existingToken.tenant,
      scopes: existingToken.scopes,
      iat: now,
      exp,
      jti: newJti
    };

    // Create JWT
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
      return new Response(
        JSON.stringify({ error: 'JWT secret not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newToken = await createJWT(payload, jwtSecret);
    const newTokenHash = await hashToken(newToken);

    // Revoke old token and create new one in transaction-like operations
    const revokePromise = supabase
      .from('access_tokens')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('jti', jti)
      .eq('user_id', user.id);

    const createPromise = supabase
      .from('access_tokens')
      .insert({
        jti: newJti,
        nome: `${existingToken.nome} (rotated)`,
        token_hash: newTokenHash,
        user_id: user.id,
        tenant: existingToken.tenant,
        scopes: existingToken.scopes,
        role: existingToken.role,
        expires_at: new Date(exp * 1000).toISOString(),
        status: 'active'
      })
      .select()
      .single();

    const [revokeResult, createResult] = await Promise.all([revokePromise, createPromise]);

    if (revokeResult.error) {
      console.error('Revoke error:', revokeResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to revoke old token' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (createResult.error) {
      console.error('Create error:', createResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to create new token' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit actions
    const auditPromises = [
      logAuditAction(
        supabase, 
        jti, 
        user.id, 
        'rotated', 
        { old_jti: jti, new_jti: newJti, nome: existingToken.nome },
        req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown',
        req.headers.get('user-agent') || 'unknown'
      ),
      logAuditAction(
        supabase, 
        newJti, 
        user.id, 
        'created', 
        { created_by_rotation: true, old_jti: jti, nome: createResult.data.nome },
        req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown',
        req.headers.get('user-agent') || 'unknown'
      )
    ];

    await Promise.all(auditPromises);

    return new Response(JSON.stringify({
      rotated: true,
      token: newToken,
      type: 'Bearer',
      expires_at: createResult.data.expires_at,
      scopes: existingToken.scopes,
      tenant: existingToken.tenant,
      old_jti: jti,
      new_jti: newJti
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