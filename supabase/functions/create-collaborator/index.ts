import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CollaboratorRequest {
  nome: string
  email: string
  role: 'operador' | 'administrador'
  password: string
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
      throw new Error('Only administrators can create collaborators')
    }

    const { nome, email, role, password }: CollaboratorRequest = await req.json()

    if (!nome || !email || !role || !password) {
      throw new Error('Nome, email, role and password are required')
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long')
    }

    console.log(`Admin ${user.email} is creating collaborator ${email} with role ${role}`)

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single()
    
    if (existingUser) {
      throw new Error('E-mail já cadastrado no sistema')
    }

    // Create the user directly in auth.users
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        nome: nome,
        role: role
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      throw new Error(createError.message || 'Failed to create user')
    }

    if (!newUser.user) {
      throw new Error('Failed to create user - no user returned')
    }

    console.log(`User created successfully: ${newUser.user.id}`)

    // The profile and user_roles will be created automatically by the handle_new_user trigger

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Colaborador cadastrado com sucesso',
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          nome: nome,
          role: role
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Collaborator creation error:', error)
    
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