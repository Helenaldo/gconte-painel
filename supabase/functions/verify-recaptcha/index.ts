import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: armazenar tentativas por IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 10; // máximo 10 tentativas por IP em 15 minutos

function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfIP = req.headers.get('cf-connecting-ip');
  
  return cfIP || realIP || forwarded?.split(',')[0] || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    // Reset counter
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, resetTime: entry.resetTime };
  }
  
  entry.count++;
  return { allowed: true };
}

function logSecurityEvent(ip: string, event: string, details: any) {
  console.log(`[SECURITY] ${new Date().toISOString()} - IP: ${ip} - Event: ${event}`, details);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const startTime = Date.now();
  
  try {
    // Rate limiting check
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      logSecurityEvent(clientIP, 'RATE_LIMITED', { 
        resetTime: rateCheck.resetTime,
        maxAttempts: MAX_ATTEMPTS 
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Muitas tentativas. Tente novamente em alguns minutos.',
          retryAfter: Math.ceil((rateCheck.resetTime! - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateCheck.resetTime! - Date.now()) / 1000).toString()
          },
        }
      );
    }

    const { recaptchaToken, userAgent, timestamp } = await req.json();

    if (!recaptchaToken) {
      logSecurityEvent(clientIP, 'MISSING_TOKEN', { userAgent });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token reCAPTCHA é obrigatório' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get reCAPTCHA secret key from office table
    const { data: office, error: officeError } = await supabase
      .from('office')
      .select('recaptcha_secret_key')
      .maybeSingle();

    if (officeError) {
      console.error('Erro ao buscar chave secreta do banco:', officeError);
      logSecurityEvent(clientIP, 'DB_ERROR', { error: officeError.message });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro interno do servidor' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if secret key is configured
    if (!office?.recaptcha_secret_key) {
      logSecurityEvent(clientIP, 'NO_SECRET_KEY', { hasOfficeData: !!office });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'reCAPTCHA não configurado. Configure as chaves nas configurações do escritório.' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const secretKey = office.recaptcha_secret_key;

    // Log verification attempt
    logSecurityEvent(clientIP, 'VERIFICATION_START', {
      userAgent,
      timestamp,
      hasToken: !!recaptchaToken,
      tokenLength: recaptchaToken?.length
    });

    // Verify reCAPTCHA with Google
    const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: recaptchaToken,
        remoteip: clientIP, // Include client IP for additional verification
      }),
    });

    const verifyResult = await verifyResponse.json();
    const processingTime = Date.now() - startTime;

    console.log(`[reCAPTCHA] Verification result for IP ${clientIP}:`, {
      success: verifyResult.success,
      hostname: verifyResult.hostname,
      challenge_ts: verifyResult.challenge_ts,
      error_codes: verifyResult['error-codes'],
      processing_time_ms: processingTime
    });

    if (verifyResult.success) {
      // Check score if available (v3)
      const score = verifyResult.score || 1;
      
      logSecurityEvent(clientIP, 'VERIFICATION_SUCCESS', {
        hostname: verifyResult.hostname,
        score: score,
        processingTime
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'reCAPTCHA validado com sucesso',
          score: score,
          hostname: verifyResult.hostname
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      const errorCodes = verifyResult['error-codes'] || [];
      
      logSecurityEvent(clientIP, 'VERIFICATION_FAILED', {
        errorCodes,
        hostname: verifyResult.hostname,
        processingTime
      });
      
      let errorMessage = 'Falha na verificação do reCAPTCHA';
      let statusCode = 400;
      
      // Handle specific error codes with better messaging
      if (errorCodes.includes('invalid-input-secret')) {
        errorMessage = 'Configuração do reCAPTCHA inválida. Entre em contato com o administrador.';
        statusCode = 500;
      } else if (errorCodes.includes('invalid-input-response')) {
        errorMessage = 'Token reCAPTCHA inválido. Recarregue a página e tente novamente.';
      } else if (errorCodes.includes('bad-request')) {
        errorMessage = 'Requisição inválida. Recarregue a página e tente novamente.';
      } else if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = 'Token reCAPTCHA expirado ou já utilizado. Complete o reCAPTCHA novamente.';
      } else if (errorCodes.includes('hostname-mismatch')) {
        errorMessage = 'Domínio não autorizado. Configure os domínios corretos no Console do Google reCAPTCHA.';
        statusCode = 403;
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          errorCodes: errorCodes,
          hostname: verifyResult.hostname,
          canRetry: !errorCodes.includes('invalid-input-secret')
        }),
        {
          status: statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Erro interno na verificação do reCAPTCHA:', error);
    
    logSecurityEvent(clientIP, 'INTERNAL_ERROR', {
      error: error.message,
      processingTime
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno do servidor. Tente novamente em alguns instantes.' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});