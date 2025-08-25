import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { X509Certificate } from "node:crypto"
import * as forge from "https://esm.sh/node-forge@1.3.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CertificateData {
  subject: { cn?: string; o?: string }
  icpBrasilData: { cnpj?: string }
  validity: { notBefore?: string; notAfter?: string }
  serialNumber?: string
}

function extractCNPJFromSAN(certificate: X509Certificate): string | null {
  console.log('Extracting CNPJ from Subject Alternative Name...')
  
  try {
    const sanExtension = certificate.subjectAltName
    
    if (!sanExtension) {
      console.log('No Subject Alternative Name extension found')
      return null
    }
    
    console.log('SAN Extension:', sanExtension)
    
    // Look for CNPJ pattern in SAN (ICP-Brasil uses OID 2.16.76.1.3.3)
    const cnpjMatch = sanExtension.match(/(\d{14}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g)
    
    if (cnpjMatch) {
      for (const match of cnpjMatch) {
        const digits = match.replace(/\D/g, '')
        if (digits.length === 14 && isValidCNPJFormat(digits)) {
          const formattedCNPJ = formatCNPJ(digits)
          console.log(`Successfully extracted CNPJ from SAN: ${formattedCNPJ}`)
          return formattedCNPJ
        }
      }
    }
    
    // Try to extract from raw certificate data
    return extractCNPJFromRawData(certificate.raw)
    
  } catch (error) {
    console.error('Error extracting CNPJ from SAN:', error)
    return extractCNPJFromRawData(certificate.raw)
  }
}

function extractCNPJFromRawData(rawData: Buffer): string | null {
  console.log('Searching for CNPJ in raw certificate data...')
  
  try {
    // Convert raw data to string and search for CNPJ patterns
    const dataStr = new TextDecoder('utf-8', { fatal: false }).decode(rawData)
    const cnpjMatch = dataStr.match(/(\d{14})/g)
    
    if (cnpjMatch) {
      for (const match of cnpjMatch) {
        if (isValidCNPJFormat(match)) {
          const formattedCNPJ = formatCNPJ(match)
          console.log(`Found CNPJ in certificate data: ${formattedCNPJ}`)
          return formattedCNPJ
        }
      }
    }
  } catch (error) {
    console.error('Error extracting CNPJ from raw data:', error)
  }
  
  return null
}

function isValidCNPJFormat(cnpj: string): boolean {
  if (cnpj.length !== 14) return false
  if (/^0+$/.test(cnpj)) return false // All zeros
  if (/^(\d)\1{13}$/.test(cnpj)) return false // All same digits
  return true
}

function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function processPKCS12Certificate(certBuffer: Uint8Array, password: string): CertificateData {
  console.log('Processing PKCS#12 certificate with password authentication...')
  
  try {
    // Convert Uint8Array to binary string for node-forge
    const p12Buffer = Array.from(certBuffer).map(byte => String.fromCharCode(byte)).join('')
    
    console.log('Parsing PKCS#12 ASN.1 structure...')
    
    // Parse the PKCS#12 structure
    const p12Asn1 = forge.asn1.fromDer(p12Buffer)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
    
    console.log('PKCS#12 decrypted successfully!')
    
    // Get certificate bags
    const certBags = p12.getBags({ bagType: forge.pkcs12.oids.certBag })
    const bags = certBags[forge.pkcs12.oids.certBag]
    
    if (!bags || bags.length === 0) {
      throw new Error('Nenhum certificado encontrado no arquivo PKCS#12')
    }
    
    console.log(`Found ${bags.length} certificate(s) in PKCS#12`)
    
    // Get the first certificate
    const cert = bags[0].cert
    
    if (!cert) {
      throw new Error('Certificado não encontrado ou corrompido no PKCS#12')
    }
    
    console.log('Certificate extracted from PKCS#12, converting to X509Certificate...')
    
    // Convert to PEM format
    const certPem = forge.pki.certificateToPem(cert)
    console.log('Certificate converted to PEM format')
    
    // Create X509Certificate instance using node:crypto
    const certificate = new X509Certificate(certPem)
    
    console.log('=== Certificate analysis using node:crypto ===')
    console.log('Certificate subject:', certificate.subject)
    console.log('Certificate issuer:', certificate.issuer)
    console.log('Certificate valid from:', certificate.validFrom)
    console.log('Certificate valid to:', certificate.validTo)
    console.log('Certificate serial number:', certificate.serialNumber)
    
    // Extract subject information using native methods
    const subject: { cn?: string; o?: string } = {}
    
    // Parse subject string to extract CN and O
    const subjectParts = certificate.subject.split(',').map(part => part.trim())
    for (const part of subjectParts) {
      if (part.startsWith('CN=')) {
        subject.cn = part.substring(3).trim()
      } else if (part.startsWith('O=')) {
        subject.o = part.substring(2).trim()
      }
    }
    
    console.log('Extracted subject:', subject)
    
    // Extract validity dates using native properties
    const validity = {
      notBefore: certificate.validFrom,
      notAfter: certificate.validTo
    }
    
    console.log('Extracted validity:', validity)
    
    // Extract serial number using native property
    const serialNumber = certificate.serialNumber
    
    console.log('Extracted serial number:', serialNumber)
    
    // Extract CNPJ from Subject Alternative Name
    const cnpj = extractCNPJFromSAN(certificate)
    
    console.log('=== Certificate Analysis Results ===')
    console.log('Subject:', subject)
    console.log('CNPJ from SAN:', cnpj)
    console.log('Validity:', validity)
    console.log('Serial Number:', serialNumber)
    
    // Validation - ensure we have essential data
    if (!subject.cn && !subject.o) {
      console.error('No subject information found')
      throw new Error('Não foi possível extrair informações do subject do certificado.')
    }
    
    if (!validity.notBefore || !validity.notAfter) {
      console.error('No validity dates found')
      throw new Error('Não foi possível extrair datas de validade do certificado.')
    }
    
    return {
      subject,
      icpBrasilData: { cnpj },
      validity,
      serialNumber
    }
    
  } catch (error) {
    console.error('Error processing PKCS#12 certificate:', error)
    
    // Check for specific error types
    if (error.message?.includes('Invalid password') || error.message?.includes('MAC verify error') || error.message?.includes('HMAC verify failure')) {
      throw new Error('Senha incorreta para o certificado PKCS#12.')
    }
    
    if (error.message?.includes('Invalid PKCS#12') || error.message?.includes('not a PKCS#12')) {
      throw new Error('Arquivo não é um certificado PKCS#12 válido.')
    }
    
    throw new Error(`Erro ao processar certificado PKCS#12: ${error.message}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== Certificate Processing Request ===')
    
    const formData = await req.formData()
    const file = formData.get('file') as File
    const password = formData.get('password') as string

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Arquivo de certificado é obrigatório' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Senha do certificado é obrigatória' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log(`Processing certificate: ${file.name} (${file.size} bytes)`)

    // Read the certificate file
    const arrayBuffer = await file.arrayBuffer()
    const certificateBuffer = new Uint8Array(arrayBuffer)
    
    try {
      // Process the PKCS#12 certificate
      const certData = processPKCS12Certificate(certificateBuffer, password)
      
      // Determine company name (prefer CN, fallback to O, then filename)
      let razaoSocial = certData.subject.cn || certData.subject.o
      if (!razaoSocial) {
        razaoSocial = file.name
          .replace(/\.(pfx|p12)$/i, '')
          .replace(/[_-]/g, ' ')
          .trim()
          .toUpperCase()
      }
      
      // Use extracted CNPJ or try filename extraction as last resort
      let cnpj = certData.icpBrasilData.cnpj
      if (!cnpj) {
        console.log('No CNPJ found in certificate, trying filename extraction...')
        const filenameMatch = file.name.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g)
        if (filenameMatch) {
          const digits = filenameMatch[0].replace(/\D/g, '')
          if (digits.length === 14) {
            cnpj = formatCNPJ(digits)
            console.log('Extracted CNPJ from filename:', cnpj)
          }
        }
      }
      
      // If still no CNPJ found, return error
      if (!cnpj) {
        throw new Error('Não foi possível extrair o CNPJ do certificado. Verifique se é um certificado ICP-Brasil válido.')
      }
      
      // Check if we have valid dates
      let dataInicio = certData.validity.notBefore
      let dataVencimento = certData.validity.notAfter
      
      if (!dataInicio || !dataVencimento) {
        throw new Error('Não foi possível extrair as datas de validade do certificado.')
      }
      
      // Ensure dates are valid ISO strings
      const ensureValidDate = (dateStr: string): string => {
        try {
          const date = new Date(dateStr)
          if (isNaN(date.getTime())) {
            throw new Error('Data inválida')
          }
          return date.toISOString()
        } catch {
          throw new Error('Formato de data inválido no certificado')
        }
      }
      
      const certificateInfo = {
        cnpj_certificado: cnpj,
        razao_social: razaoSocial,
        emissor: "Certificado Digital ICP-Brasil",
        numero_serie: certData.serialNumber || Math.random().toString(36).substring(2, 15).toUpperCase(),
        data_inicio: ensureValidDate(dataInicio),
        data_vencimento: ensureValidDate(dataVencimento),
      }
      
      console.log('=== Certificate Processing Result ===')
      console.log('CNPJ:', certificateInfo.cnpj_certificado)
      console.log('Razão Social:', certificateInfo.razao_social)
      console.log('Número Série:', certificateInfo.numero_serie)
      console.log('Data Início:', certificateInfo.data_inicio)
      console.log('Data Vencimento:', certificateInfo.data_vencimento)
      
      return new Response(
        JSON.stringify(certificateInfo),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
      
    } catch (parseError) {
      console.error('Error processing certificate:', parseError)
      
      return new Response(
        JSON.stringify({ 
          error: parseError.message || 'Não foi possível processar o certificado. Verifique se o arquivo e a senha estão corretos.',
          details: parseError.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

  } catch (error) {
    console.error('Fatal error processing certificate:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor ao processar certificado',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})