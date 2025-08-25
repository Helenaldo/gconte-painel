import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { X509Certificate } from "node:crypto"
import * as forge from "https://esm.sh/node-forge@1.3.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CertificateData {
  subject: { cn?: string; o?: string }
  cnpj: string | null
  validity: { notBefore: string; notAfter: string }
  serialNumber: string
}

function extractCNPJFromSAN(certificate: X509Certificate): string | null {
  console.log('Extracting CNPJ from Subject Alternative Name...')
  
  try {
    const sanExtension = certificate.subjectAltName
    
    if (!sanExtension) {
      console.log('No Subject Alternative Name extension found')
      return null
    }
    
    console.log('SAN Extension content:', sanExtension)
    
    // Look for CNPJ pattern in SAN (ICP-Brasil CNPJ in various formats)
    const cnpjPatterns = [
      /(\d{14})/g,
      /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g
    ]
    
    for (const pattern of cnpjPatterns) {
      const matches = sanExtension.match(pattern)
      if (matches) {
        for (const match of matches) {
          const digits = match.replace(/\D/g, '')
          if (digits.length === 14 && isValidCNPJFormat(digits)) {
            const formattedCNPJ = formatCNPJ(digits)
            console.log(`Successfully extracted CNPJ from SAN: ${formattedCNPJ}`)
            return formattedCNPJ
          }
        }
      }
    }
    
    console.log('No valid CNPJ found in SAN extension')
    return null
    
  } catch (error) {
    console.error('Error extracting CNPJ from SAN:', error)
    return null
  }
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
  console.log('=== Starting PKCS#12 Certificate Processing ===')
  console.log(`Certificate buffer size: ${certBuffer.length} bytes`)
  console.log(`Password provided: ${password ? 'Yes' : 'No'}`)
  
  try {
    // Convert Uint8Array to binary string for node-forge
    const p12Buffer = Array.from(certBuffer).map(byte => String.fromCharCode(byte)).join('')
    
    console.log('Step 1: Parsing PKCS#12 ASN.1 structure...')
    
    // Parse the PKCS#12 structure
    const p12Asn1 = forge.asn1.fromDer(p12Buffer)
    console.log('PKCS#12 ASN.1 structure parsed successfully')
    
    console.log('Step 2: Decrypting PKCS#12 with provided password...')
    
    // Decrypt PKCS#12 with password
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
    console.log('PKCS#12 decrypted successfully!')
    
    console.log('Step 3: Extracting certificate from PKCS#12 bags...')
    
    // Get certificate bags
    const certBags = p12.getBags({ bagType: forge.pkcs12.oids.certBag })
    const bags = certBags[forge.pkcs12.oids.certBag]
    
    if (!bags || bags.length === 0) {
      throw new Error('CERT_NOT_FOUND: Nenhum certificado encontrado no arquivo PKCS#12')
    }
    
    console.log(`Found ${bags.length} certificate(s) in PKCS#12`)
    
    // Get the first certificate
    const forgeCert = bags[0].cert
    
    if (!forgeCert) {
      throw new Error('CERT_CORRUPTED: Certificado não encontrado ou corrompido no PKCS#12')
    }
    
    console.log('Step 4: Converting certificate to PEM format...')
    
    // Convert to PEM format for node:crypto
    const certPem = forge.pki.certificateToPem(forgeCert)
    console.log('Certificate converted to PEM format successfully')
    
    console.log('Step 5: Creating X509Certificate instance with node:crypto...')
    
    // Create X509Certificate instance using node:crypto
    const certificate = new X509Certificate(certPem)
    
    console.log('=== Certificate Data Extraction Using Native Methods ===')
    console.log('Raw subject:', certificate.subject)
    console.log('Raw issuer:', certificate.issuer)
    console.log('Valid from:', certificate.validFrom)
    console.log('Valid to:', certificate.validTo)
    console.log('Serial number:', certificate.serialNumber)
    
    // Extract subject information using native methods
    const subject: { cn?: string; o?: string } = {}
    
    // Parse subject string to extract CN and O
    const subjectParts = certificate.subject.split(/,\s*/)
    for (const part of subjectParts) {
      const trimmedPart = part.trim()
      if (trimmedPart.startsWith('CN=')) {
        subject.cn = trimmedPart.substring(3).trim()
      } else if (trimmedPart.startsWith('O=')) {
        subject.o = trimmedPart.substring(2).trim()
      }
    }
    
    console.log('Extracted subject data:', subject)
    
    // Extract validity dates using native properties
    const validity = {
      notBefore: certificate.validFrom,
      notAfter: certificate.validTo
    }
    
    console.log('Extracted validity dates:', validity)
    
    // Extract serial number using native property
    const serialNumber = certificate.serialNumber
    console.log('Extracted serial number:', serialNumber)
    
    // Extract CNPJ from Subject Alternative Name using native methods
    const cnpj = extractCNPJFromSAN(certificate)
    console.log('Extracted CNPJ:', cnpj)
    
    console.log('=== Final Certificate Analysis Results ===')
    console.log('Subject CN:', subject.cn)
    console.log('Subject O:', subject.o)
    console.log('CNPJ from SAN:', cnpj)
    console.log('Valid from:', validity.notBefore)
    console.log('Valid to:', validity.notAfter)
    console.log('Serial Number:', serialNumber)
    
    // Validation - ensure we have essential data
    if (!subject.cn && !subject.o) {
      throw new Error('DATA_EXTRACTION_FAILED: Não foi possível extrair informações do subject do certificado (CN ou O não encontrados)')
    }
    
    if (!validity.notBefore || !validity.notAfter) {
      throw new Error('DATA_EXTRACTION_FAILED: Não foi possível extrair datas de validade do certificado')
    }
    
    if (!serialNumber) {
      throw new Error('DATA_EXTRACTION_FAILED: Não foi possível extrair número de série do certificado')
    }
    
    return {
      subject,
      cnpj,
      validity,
      serialNumber
    }
    
  } catch (error) {
    console.error('=== Error Processing PKCS#12 Certificate ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    // Specific error handling for different failure scenarios
    if (error.message?.includes('DATA_EXTRACTION_FAILED')) {
      throw error // Re-throw data extraction errors as-is
    }
    
    if (error.message?.includes('CERT_NOT_FOUND') || error.message?.includes('CERT_CORRUPTED')) {
      throw error // Re-throw certificate structure errors as-is
    }
    
    if (error.message?.includes('Invalid password') || 
        error.message?.includes('MAC verify error') || 
        error.message?.includes('HMAC verify failure') ||
        error.message?.includes('mac verify failure') ||
        error.message?.includes('Authentication tag')) {
      throw new Error('INVALID_PASSWORD: Senha incorreta para o certificado PKCS#12')
    }
    
    if (error.message?.includes('Invalid PKCS#12') || 
        error.message?.includes('not a PKCS#12') ||
        error.message?.includes('ASN.1 parse error') ||
        error.message?.includes('DER decode error')) {
      throw new Error('INVALID_FORMAT: Arquivo não é um certificado PKCS#12 válido ou está corrompido')
    }
    
    if (error.message?.includes('Cannot find module') || error.message?.includes('node-forge')) {
      throw new Error('DEPENDENCY_ERROR: Erro na biblioteca de processamento de certificados')
    }
    
    // Generic error for unexpected issues
    throw new Error(`PROCESSING_ERROR: Erro inesperado ao processar certificado PKCS#12: ${error.message}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== New Certificate Processing Request ===')
    
    const formData = await req.formData()
    const file = formData.get('file') as File
    const password = formData.get('password') as string

    // Input validation
    if (!file) {
      console.error('Missing file in request')
      return new Response(
        JSON.stringify({ error: 'MISSING_FILE: Arquivo de certificado é obrigatório' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    if (!password) {
      console.error('Missing password in request')
      return new Response(
        JSON.stringify({ error: 'MISSING_PASSWORD: Senha do certificado é obrigatória' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log(`Processing certificate: ${file.name}`)
    console.log(`File size: ${file.size} bytes`)
    console.log(`File type: ${file.type}`)

    // File format validation
    if (!file.name.match(/\.(pfx|p12)$/i)) {
      console.error('Invalid file format:', file.name)
      return new Response(
        JSON.stringify({ error: 'INVALID_FORMAT: Arquivo deve ser um certificado PKCS#12 (.pfx ou .p12)' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Read the certificate file
    const arrayBuffer = await file.arrayBuffer()
    const certificateBuffer = new Uint8Array(arrayBuffer)
    
    // Process the PKCS#12 certificate
    const certData = processPKCS12Certificate(certificateBuffer, password)
    
    // Determine company name (prefer CN, fallback to O)
    let razaoSocial = certData.subject.cn || certData.subject.o
    if (!razaoSocial) {
      // Last resort: use filename
      razaoSocial = file.name
        .replace(/\.(pfx|p12)$/i, '')
        .replace(/[_-]/g, ' ')
        .trim()
        .toUpperCase()
    }
    
    // Use extracted CNPJ - if not found, try filename as absolute last resort
    let cnpj = certData.cnpj
    if (!cnpj) {
      console.log('No CNPJ found in certificate SAN, trying filename extraction as last resort...')
      const filenameMatch = file.name.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g)
      if (filenameMatch) {
        const digits = filenameMatch[0].replace(/\D/g, '')
        if (digits.length === 14 && isValidCNPJFormat(digits)) {
          cnpj = formatCNPJ(digits)
          console.log('Extracted CNPJ from filename:', cnpj)
        }
      }
    }
    
    // If still no CNPJ found, it's not necessarily an error for some certificate types
    // But for ICP-Brasil certificates, CNPJ should be present
    if (!cnpj) {
      console.warn('CNPJ not found in certificate or filename')
    }
    
    // Ensure dates are valid ISO strings
    const ensureValidDate = (dateStr: string): string => {
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date')
        }
        return date.toISOString()
      } catch {
        throw new Error('INVALID_DATE: Formato de data inválido no certificado')
      }
    }
    
    const certificateInfo = {
      cnpj_certificado: cnpj,
      razao_social: razaoSocial,
      emissor: "Certificado Digital ICP-Brasil",
      numero_serie: certData.serialNumber,
      data_inicio: ensureValidDate(certData.validity.notBefore),
      data_vencimento: ensureValidDate(certData.validity.notAfter),
    }
    
    console.log('=== Certificate Processing Successfully Completed ===')
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
    console.error('=== Certificate Processing Error ===')
    console.error('Error:', parseError.message)
    
    // Map error types to user-friendly messages and appropriate HTTP status codes
    let statusCode = 400
    let errorMessage = parseError.message
    
    if (parseError.message?.includes('INVALID_PASSWORD')) {
      statusCode = 401
      errorMessage = 'Senha incorreta. Verifique a senha do certificado e tente novamente.'
    } else if (parseError.message?.includes('INVALID_FORMAT')) {
      statusCode = 400
      errorMessage = 'Arquivo inválido. Certifique-se de que é um certificado PKCS#12 válido (.pfx ou .p12).'
    } else if (parseError.message?.includes('CERT_NOT_FOUND')) {
      statusCode = 400
      errorMessage = 'Nenhum certificado encontrado no arquivo. Verifique se o arquivo não está corrompido.'
    } else if (parseError.message?.includes('CERT_CORRUPTED')) {
      statusCode = 400
      errorMessage = 'Certificado corrompido ou ilegível. Tente com outro arquivo.'
    } else if (parseError.message?.includes('DATA_EXTRACTION_FAILED')) {
      statusCode = 422
      errorMessage = 'Não foi possível extrair dados essenciais do certificado. O certificado pode estar em formato não suportado.'
    } else if (parseError.message?.includes('DEPENDENCY_ERROR')) {
      statusCode = 500
      errorMessage = 'Erro interno do servidor. Tente novamente em alguns instantes.'
    } else if (parseError.message?.includes('PROCESSING_ERROR')) {
      statusCode = 500
      errorMessage = 'Erro ao processar o certificado. Tente novamente ou entre em contato com o suporte.'
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        technical_details: parseError.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode 
      }
    )

  } catch (error) {
    console.error('=== Fatal Server Error ===')
    console.error('Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor. Tente novamente em alguns instantes.',
        technical_details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})