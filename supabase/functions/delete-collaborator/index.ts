import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteRequest {
  userId: string
  userEmail: string
}

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the user making the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Authorization header missing')
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Invalid authorization:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Check if the requesting user is an admin
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Error checking user permissions' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    if (!userProfile || userProfile.role !== 'administrador') {
      console.error('User is not admin:', user.email, userProfile?.role)
      return new Response(
        JSON.stringify({ error: 'Only administrators can delete collaborators' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    const { userId, userEmail }: DeleteRequest = await req.json()

    if (!userId || !userEmail) {
      console.error('Missing userId or userEmail')
      return new Response(
        JSON.stringify({ error: 'User ID and email are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Prevent self-deletion
    if (userId === user.id) {
      console.error('User trying to delete themselves:', user.email)
      return new Response(
        JSON.stringify({ error: 'Você não pode excluir sua própria conta' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log(`Admin ${user.email} is deleting collaborator ${userEmail} (${userId})`)

    // Delete all related data first
    console.log('Deleting related data...')

    // Delete from processos where user is responsible
    const { error: processosError } = await supabaseAdmin
      .from('processos')
      .delete()
      .eq('responsavel_id', userId)

    if (processosError) {
      console.error('Error deleting processos:', processosError)
    } else {
      console.log('Deleted processos for user')
    }

    // Delete from movimentos where user is responsible  
    const { error: movimentosError } = await supabaseAdmin
      .from('movimentos')
      .delete()
      .eq('responsavel_id', userId)

    if (movimentosError) {
      console.error('Error deleting movimentos:', movimentosError)
    } else {
      console.log('Deleted movimentos for user')
    }

    // Delete from invitations where user was invited by this user
    const { error: invitationsError } = await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('invited_by', userId)

    if (invitationsError) {
      console.error('Error deleting invitations:', invitationsError)
    } else {
      console.log('Deleted invitations for user')
    }

    // Delete from user_roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (rolesError) {
      console.error('Error deleting user roles:', rolesError)
    } else {
      console.log('Deleted user roles')
    }

    // Delete from profiles
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profilesError) {
      console.error('Error deleting profile:', profilesError)
    } else {
      console.log('Deleted profile')
    }

    // Finally, delete from auth.users
    console.log('Deleting from auth.users...')
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('Error deleting from auth.users:', deleteAuthError)
      return new Response(
        JSON.stringify({ 
          error: `Erro ao excluir usuário do sistema de autenticação: ${deleteAuthError.message}` 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log(`Collaborator ${userEmail} successfully deleted from all tables`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Colaborador excluído com sucesso de todas as tabelas'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Collaborator deletion error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: `Erro interno: ${error.message || 'Unknown error'}` 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}

serve(handler)