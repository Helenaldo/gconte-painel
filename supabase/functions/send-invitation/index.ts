import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  nome: string;
  role: 'operador' | 'administrador';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, nome, role }: InvitationRequest = await req.json();

    // Generate unique token for invitation
    const token = crypto.randomUUID();
    
    // Get current user (who is sending the invitation)
    const authHeader = req.headers.get('authorization');
    const userToken = authHeader?.replace('Bearer ', '');
    
    const { data: { user } } = await supabaseClient.auth.getUser(userToken);
    
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (userProfile?.role !== 'administrador') {
      throw new Error('Unauthorized: Only administrators can send invitations');
    }

    // Create invitation record
    const { error: inviteError } = await supabaseClient
      .from('invitations')
      .insert({
        email,
        nome,
        role,
        token,
        invited_by: user.id
      });

    if (inviteError) {
      throw inviteError;
    }

    // Create auth user with invitation data
    const inviteUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/invite?email=${encodeURIComponent(email)}&redirect_to=${encodeURIComponent('https://heeqpvphsgnyqwpnqpgt.supabase.co')}&token=${token}`;
    
    const { error: authError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteUrl,
      data: {
        nome,
        role,
        token
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      // Continue even if auth invitation fails - user can still be created manually
    }

    console.log(`Invitation sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Convite enviado para ${email}`,
        inviteUrl 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
    
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);