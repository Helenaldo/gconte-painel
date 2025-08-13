import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PasswordRequest {
  userId: string
  newPassword: string
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
      throw new Error('Only administrators can manage passwords')
    }

    const { userId, newPassword, userEmail }: PasswordRequest = await req.json()

    if (!userId || !newPassword || !userEmail) {
      throw new Error('User ID, new password, and email are required')
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long')
    }

    console.log(`Admin ${user.email} is updating password for user ${userEmail}`)

    // Update the user's password using admin client
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (error) {
      console.error('Error updating password:', error)
      throw new Error(error.message || 'Failed to update password')
    }

    console.log(`Password successfully updated for user ${userEmail}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password updated successfully',
        user: data.user?.email 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Password management error:', error)
    
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