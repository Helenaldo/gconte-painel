import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from "https://deno.land/std@0.182.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'HEAD, GET, OPTIONS',
};

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

async function validateBearerToken(authHeader: string | null): Promise<{valid: boolean, payload?: any, error?: string}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const jwtSecret = Deno.env.get('JWT_SECRET');
  if (!jwtSecret) {
    return { valid: false, error: 'JWT secret not configured' };
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
      return { valid: false, error: 'Token not found or revoked' };
    }

    // Check if token is expired (double check)
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return { valid: false, error: 'Token expired' };
    }

    // Update last used timestamp (fire and forget)
    supabase
      .from('access_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('jti', payload.jti)
      .then(() => {});

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!['HEAD', 'GET'].includes(req.method)) {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const result = await validateBearerToken(authHeader);

    if (!result.valid) {
      const errorResponse = {
        valid: false,
        error: result.error
      };

      if (req.method === 'HEAD') {
        return new Response(null, { 
          status: 401,
          headers: { 
            ...corsHeaders,
            'X-Token-Valid': 'false',
            'X-Token-Error': result.error || 'Unknown error'
          }
        });
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const response = {
      valid: true,
      scopes: result.payload.scopes || [],
      role: result.payload.role,
      tenant: result.payload.tenant,
      exp: new Date(result.payload.exp * 1000).toISOString(),
      iat: new Date(result.payload.iat * 1000).toISOString(),
      jti: result.payload.jti
    };

    if (req.method === 'HEAD') {
      return new Response(null, { 
        status: 200,
        headers: { 
          ...corsHeaders,
          'X-Token-Valid': 'true',
          'X-Token-Scopes': result.payload.scopes?.join(',') || '',
          'X-Token-Role': result.payload.role || '',
          'X-Token-Tenant': result.payload.tenant || '',
          'X-Token-Expires': response.exp
        }
      });
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    
    if (req.method === 'HEAD') {
      return new Response(null, { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'X-Token-Valid': 'false',
          'X-Token-Error': 'Internal server error'
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        valid: false,
        error: 'Internal server error' 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});