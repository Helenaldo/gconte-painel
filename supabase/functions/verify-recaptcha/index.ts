import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recaptchaToken } = await req.json();

    if (!recaptchaToken) {
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
      console.error('Erro ao buscar chave secreta:', officeError);
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

    // Use test secret key if no secret key is configured
    const secretKey = office?.recaptcha_secret_key || '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

    // Verify reCAPTCHA with Google
    const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: recaptchaToken,
      }),
    });

    const verifyResult = await verifyResponse.json();

    console.log('reCAPTCHA verification result:', verifyResult);

    if (verifyResult.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'reCAPTCHA válido' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      console.error('reCAPTCHA verification failed:', verifyResult['error-codes']);
      
      let errorMessage = 'Falha na verificação do reCAPTCHA';
      
      // Handle specific error codes
      if (verifyResult['error-codes']) {
        const errorCodes = verifyResult['error-codes'];
        if (errorCodes.includes('invalid-input-secret')) {
          errorMessage = 'Chave secreta do reCAPTCHA inválida. Verifique a configuração.';
        } else if (errorCodes.includes('hostname-mismatch')) {
          errorMessage = 'Domínio não autorizado para esta chave reCAPTCHA. Configure os domínios corretos no Console do Google.';
        } else if (errorCodes.includes('timeout-or-duplicate')) {
          errorMessage = 'Token reCAPTCHA expirado ou já utilizado. Tente novamente.';
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          errorCodes: verifyResult['error-codes']
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Erro na verificação do reCAPTCHA:', error);
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
});