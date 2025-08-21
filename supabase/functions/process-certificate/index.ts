import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { forge } from "https://esm.sh/node-forge@1.3.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

function extractCNPJFromSAN(certificate: any): string | null {
  try {
    // Look for Subject Alternative Name extension
    const sanExtension = certificate.extensions?.find((ext: any) => 
      ext.name === 'subjectAltName' || ext.id === '2.5.29.17'
    )
    
    if (!sanExtension) return null
    
    // Parse SAN for otherName with OID 2.16.76.1.3.3 (ICP Brasil CNPJ)
    const sanValue = sanExtension.value || sanExtension.altNames
    if (typeof sanValue === 'string') {
      // Try to extract CNPJ from SAN string representation
      const cnpjMatch = sanValue.match(/2\.16\.76\.1\.3\.3[^\d]*(\d{14})/i)
      if (cnpjMatch) {
        return cnpjMatch[1]
      }
    }
    
    // If altNames array exists, look for otherName entries
    if (Array.isArray(sanValue)) {
      for (const altName of sanValue) {
        if (altName.type === 0) { // otherName type
          const value = altName.value
          if (typeof value === 'string') {
            const cnpjMatch = value.match(/(\d{14})/)
            if (cnpjMatch) {
              return cnpjMatch[1]
            }
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error extracting CNPJ from SAN:', error)
    return null
  }
}

function extractCNPJFromCN(commonName: string): string | null {
  try {
    // Try to extract 14-digit CNPJ from CN as fallback
    const cnpjMatch = commonName.match(/(\d{14})/)
    return cnpjMatch ? cnpjMatch[1] : null
  } catch (error) {
    console.error('Error extracting CNPJ from CN:', error)
    return null
  }
}

function formatCNPJ(cnpj: string): string {
  // Format CNPJ with dots, slash and dash
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
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
        JSON.stringify({ error: 'Arquivo e senha são obrigatórios' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('Processing certificate file:', file.name, 'Size:', file.size)

    // Read certificate file
    const fileBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(fileBuffer)
    
    try {
      // Parse PKCS#12 certificate with password
      const p12Der = forge.util.binary.raw.encode(uint8Array)
      const p12Asn1 = forge.asn1.fromDer(p12Der)
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
      
      console.log('PKCS#12 parsed successfully')
      
      // Extract certificate from PKCS#12
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
      if (!certBags || !certBags[forge.pki.oids.certBag] || certBags[forge.pki.oids.certBag].length === 0) {
        throw new Error('Nenhum certificado encontrado no arquivo')
      }
      
      const cert = certBags[forge.pki.oids.certBag][0].cert
      if (!cert) {
        throw new Error('Certificado inválido no arquivo')
      }
      
      console.log('Certificate extracted successfully')
      
      // Extract certificate information
      const subject = cert.subject.attributes
      const issuer = cert.issuer.attributes
      
      // Get company name from CN or O
      const commonName = subject.find((attr: any) => attr.name === 'commonName')?.value || ''
      const organizationName = subject.find((attr: any) => attr.name === 'organizationName')?.value || ''
      const razaoSocial = commonName || organizationName
      
      // Extract CNPJ from SAN (preferred method)
      let cnpj = extractCNPJFromSAN(cert)
      
      // Fallback: try to extract CNPJ from CN
      if (!cnpj && commonName) {
        cnpj = extractCNPJFromCN(commonName)
      }
      
      if (!cnpj) {
        return new Response(
          JSON.stringify({ 
            error: 'CNPJ não localizado no OID ICP Brasil (2.16.76.1.3.3). Verifique se o certificado é e-CNPJ.' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      // Get issuer information
      const issuerCN = issuer.find((attr: any) => attr.name === 'commonName')?.value || 'Emissor não identificado'
      
      // Get serial number
      const serialNumber = cert.serialNumber
      
      // Get validity dates
      const notBefore = cert.validity.notBefore
      const notAfter = cert.validity.notAfter
      
      const certificateInfo = {
        cnpj_certificado: formatCNPJ(cnpj),
        razao_social: razaoSocial,
        emissor: issuerCN,
        numero_serie: serialNumber,
        data_inicio: notBefore.toISOString(),
        data_vencimento: notAfter.toISOString(),
      }
      
      console.log('Certificate info extracted:', certificateInfo)

      return new Response(
        JSON.stringify(certificateInfo),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
      
    } catch (parseError) {
      console.error('Certificate parsing error:', parseError)
      
      if (parseError.message?.includes('Invalid password') || 
          parseError.message?.includes('PKCS#12 MAC could not be verified') ||
          parseError.message?.includes('password')) {
        return new Response(
          JSON.stringify({ error: 'Senha do certificado inválida' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Arquivo corrompido ou fora do padrão. Verifique se é um certificado .pfx/.p12 válido.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
    
  } catch (error) {
    console.error('Error processing certificate:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar certificado' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})