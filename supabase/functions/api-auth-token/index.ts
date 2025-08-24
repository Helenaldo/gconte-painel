import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode, decode } from "https://deno.land/std@0.182.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function parseExpiration(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') {
    return expiresIn;
  }
  
  const str = expiresIn.toString().toLowerCase().trim();
  
  // Check for numeric hours
  const numericMatch = str.match(/^(\d+)$/);
  if (numericMatch) {
    return parseInt(numericMatch[1]);
  }
  
  // Check for time format (e.g., "24h", "7d", "30m")
  const timeMatch = str.match(/^(\d+)([hmwd])$/);
  if (timeMatch) {
    const value = parseInt(timeMatch[1]);
    const unit = timeMatch[2];
    
    switch (unit) {
      case 'm': return Math.max(1, Math.floor(value / 60)); // Convert minutes to hours (minimum 1)
      case 'h': return value;
      case 'd': return value * 24;
      case 'w': return value * 24 * 7;
      default: throw new Error(`Invalid time unit: ${unit}`);
    }
  }
  
  throw new Error(`Invalid expiration format: ${expiresIn}. Use formats like: 24, "24h", "7d", "30m"`);
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
        JSON.stringify({ error: 'Unauthorized - Administrator session required' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { nome, expira_em, scopes } = await req.json();

    if (!nome || expira_em === undefined || expira_em === null || !scopes || !Array.isArray(scopes)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: nome, expira_em, scopes' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate expiration
    let expiresInHours: number;
    try {
      expiresInHours = parseExpiration(expira_em);
      if (expiresInHours <= 0 || expiresInHours > 8760) { // Max 1 year
        throw new Error('Expiration must be between 1 hour and 1 year');
      }
    } catch (error) {
      console.error('Expiration parsing error:', error.message);
      return new Response(
        JSON.stringify({ error: `Invalid expiration format: ${error.message}` }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate scopes
    const validScopes = ['obrigacoes.read', 'obrigacoes.write', 'obrigacoes.delete', 'admin'];
    const invalidScopes = scopes.filter((scope: string) => !validScopes.includes(scope));
    if (invalidScopes.length > 0) {
      return new Response(
        JSON.stringify({ error: `Invalid scopes: ${invalidScopes.join(', ')}` }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate token payload
    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = expiresInHours * 3600; // Convert hours to seconds
    const exp = now + expiresInSeconds;
    
    // Validate expiration timestamp
    if (exp <= now || !Number.isFinite(exp)) {
      console.error('Invalid expiration timestamp:', { now, expiresInHours, expiresInSeconds, exp });
      return new Response(
        JSON.stringify({ error: 'Invalid expiration calculation' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const jti = crypto.randomUUID();

    const payload = {
      sub: user.id,
      role: 'admin',
      tenant: user.email?.split('@')[1] || 'default',
      scopes,
      iat: now,
      exp,
      jti
    };

    // Create JWT
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
      return new Response(
        JSON.stringify({ error: 'JWT secret not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = await createJWT(payload, jwtSecret);
    const tokenHash = await hashToken(token);

    // Store token metadata
    const { data: tokenRecord, error: dbError } = await supabase
      .from('access_tokens')
      .insert({
        jti,
        nome,
        token_hash: tokenHash,
        user_id: user.id,
        tenant: payload.tenant,
        scopes,
        role: 'admin',
        expires_at: new Date(exp * 1000).toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to create token record' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit action
    await logAuditAction(
      supabase, 
      jti, 
      user.id, 
      'created', 
      { nome, scopes, expires_at: tokenRecord.expires_at },
      req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown',
      req.headers.get('user-agent') || 'unknown'
    );

    // Return token (only time it's shown in plain text)
    return new Response(JSON.stringify({
      token,
      type: 'Bearer',
      expires_at: tokenRecord.expires_at,
      scopes,
      tenant: payload.tenant
    }), {
      status: 201,
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