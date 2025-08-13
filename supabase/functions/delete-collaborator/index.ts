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
      throw new Error('Authorization header is required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authorization')
    }

    // Check if the requesting user is an admin
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    if (userProfile.role !== 'administrador') {
      throw new Error('Only administrators can delete collaborators')
    }

    const { userId, userEmail }: DeleteRequest = await req.json()

    if (!userId || !userEmail) {
      throw new Error('User ID and email are required')
    }

    console.log(`Admin ${user.email} is deleting collaborator ${userEmail}`)

    // Delete from user_roles first (foreign key constraint)
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    // Delete from profiles
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    // Delete from auth.users (this will cascade delete related data)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('Error deleting from auth.users:', deleteAuthError)
      throw new Error(deleteAuthError.message || 'Failed to delete user from auth')
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
        error: error.message || 'Internal server error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}

serve(handler)