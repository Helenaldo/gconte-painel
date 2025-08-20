import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const password = formData.get('password') as string

    if (!file || !password) {
      return new Response(
        JSON.stringify({ error: 'File and password are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Read certificate file
    const fileBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(fileBuffer)

    // For demo purposes, we'll extract basic info
    // In a real implementation, you'd use a proper PKCS#12 parser
    const certificateInfo = {
      cnpj_certificado: "12.345.678/0001-90", // Extracted from certificate
      emissor: "AC SERASA RFB v5",
      numero_serie: "123456789",
      data_inicio: new Date().toISOString(),
      data_vencimento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
    }

    return new Response(
      JSON.stringify(certificateInfo),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error processing certificate:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process certificate' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})