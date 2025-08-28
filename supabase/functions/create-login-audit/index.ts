import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfIP = req.headers.get('cf-connecting-ip');
  
  return cfIP || realIP || forwarded?.split(',')[0] || 'unknown';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, user_agent, timestamp } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Action é obrigatório' 
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

    // Get authorization header to extract user
    const authHeader = req.headers.get('authorization');
    let userId = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      } catch (error) {
        console.warn('Erro ao extrair usuário do token:', error);
      }
    }

    const clientIP = getClientIP(req);

    // Create audit log entry
    const auditData = {
      user_id: userId,
      action: action,
      ip_address: clientIP,
      user_agent: user_agent || req.headers.get('user-agent'),
      details: {
        timestamp: timestamp || new Date().toISOString(),
        method: req.method,
        success: action.includes('success')
      }
    };

    // Insert into appropriate audit table based on action type
    if (action.startsWith('login') || action.startsWith('auth')) {
      // Create a generic login_audit_log table entry
      const { error } = await supabase
        .from('login_audit_log')
        .insert([auditData]);

      if (error) {
        console.error('Erro ao inserir log de auditoria de login:', error);
        // Don't fail the request, just log the error
      }
    }

    console.log(`[AUDIT] ${action} - User: ${userId || 'anonymous'} - IP: ${clientIP}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Audit log created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro ao criar log de auditoria:', error);
    
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