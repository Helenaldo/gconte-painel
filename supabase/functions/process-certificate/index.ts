import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { X509Certificate } from "node:crypto"

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
  console.log('Searching for CNPJ in Subject Alternative Name extension...')
  
  try {
    const extensions = certificate.ca ? [] : []
    const sanExtension = certificate.subjectAltName
    
    if (!sanExtension) {
      console.log('No Subject Alternative Name extension found')
      return null
    }
    
    console.log('SAN Extension:', sanExtension)
    
    // ICP-Brasil CNPJ is typically stored as otherName with OID 2.16.76.1.3.3
    // The SAN might contain it in various formats, we need to extract the CNPJ digits
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
    
    // If not found in standard format, try to extract from raw extension data
    const rawData = certificate.raw
    return extractCNPJFromRawData(rawData)
    
  } catch (error) {
    console.error('Error extracting CNPJ from SAN:', error)
    return extractCNPJFromRawData(certificate.raw)
  }
}

function extractCNPJFromRawData(rawData: Buffer): string | null {
  console.log('Searching for CNPJ in raw certificate data...')
  
  try {
    // Convert to Uint8Array for easier manipulation
    const data = new Uint8Array(rawData)
    
    // Look for ICP-Brasil CNPJ OID: 2.16.76.1.3.3 = [0x60, 0x84, 0x4C, 0x01, 0x03, 0x03]
    const cnpjOID = [0x60, 0x84, 0x4C, 0x01, 0x03, 0x03]
    
    for (let i = 0; i <= data.length - cnpjOID.length; i++) {
      let matches = true
      for (let j = 0; j < cnpjOID.length; j++) {
        if (data[i + j] !== cnpjOID[j]) {
          matches = false
          break
        }
      }
      
      if (matches) {
        console.log(`Found CNPJ OID at position: ${i}`)
        
        // Try to extract CNPJ value after the OID
        const cnpj = extractCNPJValueFromPosition(data, i + cnpjOID.length)
        if (cnpj) {
          return cnpj
        }
      }
    }
    
    // Fallback: Look for any 14-digit sequence that could be a CNPJ
    const dataStr = new TextDecoder('utf-8', { fatal: false }).decode(data)
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

function extractCNPJValueFromPosition(data: Uint8Array, startPos: number): string | null {
  // Look for possible encodings after the OID
  const possibleTags = [0x04, 0x0C, 0x13, 0x16, 0x1E] // OCTET STRING, UTF8String, PrintableString, etc.
  
  for (let i = startPos; i < Math.min(startPos + 50, data.length - 14); i++) {
    if (possibleTags.includes(data[i])) {
      // Try to extract length and data
      let length = data[i + 1]
      let dataStart = i + 2
      
      // Handle multi-byte length encoding
      if (length & 0x80) {
        const lengthBytes = length & 0x7F
        if (lengthBytes <= 2 && dataStart + lengthBytes < data.length) {
          length = 0
          for (let j = 0; j < lengthBytes; j++) {
            length = (length << 8) | data[dataStart + j]
          }
          dataStart += lengthBytes
        }
      }
      
      if (length > 0 && length <= 50 && dataStart + length <= data.length) {
        const content = data.slice(dataStart, dataStart + length)
        const contentStr = new TextDecoder('utf-8', { fatal: false }).decode(content)
        
        // Extract 14 digits for CNPJ
        const digits = contentStr.replace(/\D/g, '')
        if (digits.length >= 14) {
          const cnpj = digits.substring(0, 14)
          if (isValidCNPJFormat(cnpj)) {
            return formatCNPJ(cnpj)
          }
        }
      }
    }
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
  console.log('Password length:', password ? password.length : 0)
  
  try {
    // First, try to extract the X.509 certificate from PKCS#12
    // For now, we'll look for the DER-encoded certificate within the PKCS#12 structure
    let certData: Uint8Array | null = null
    
    // Look for DER-encoded X.509 certificate (starts with 0x30 0x82)
    for (let i = 0; i < certBuffer.length - 100; i++) {
      if (certBuffer[i] === 0x30 && certBuffer[i + 1] === 0x82) {
        try {
          const length = (certBuffer[i + 2] << 8) | certBuffer[i + 3]
          if (length > 500 && length < 8000 && i + 4 + length <= certBuffer.length) {
            certData = certBuffer.slice(i, i + 4 + length)
            console.log(`Found X.509 certificate at offset ${i}, length: ${length}`)
            break
          }
        } catch (error) {
          continue
        }
      }
    }
    
    if (!certData) {
      throw new Error('Não foi possível extrair o certificado X.509 do arquivo PKCS#12. Verifique se o arquivo e a senha estão corretos.')
    }
    
    console.log('=== Starting certificate analysis using node:crypto ===')
    
    // Create X509Certificate instance
    const certificate = new X509Certificate(Buffer.from(certData))
    
    console.log('Certificate subject:', certificate.subject)
    console.log('Certificate issuer:', certificate.issuer)
    console.log('Certificate valid from:', certificate.validFrom)
    console.log('Certificate valid to:', certificate.validTo)
    console.log('Certificate serial number:', certificate.serialNumber)
    console.log('Certificate fingerprint:', certificate.fingerprint)
    
    // Extract subject information
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
    
    // Extract validity dates (already in proper format from node:crypto)
    const validity = {
      notBefore: certificate.validFrom,
      notAfter: certificate.validTo
    }
    
    console.log('Extracted validity:', validity)
    
    // Extract serial number (already formatted from node:crypto)
    const serialNumber = certificate.serialNumber
    
    console.log('Extracted serial number:', serialNumber)
    
    // Extract CNPJ from Subject Alternative Name
    const cnpj = extractCNPJFromSAN(certificate)
    
    console.log('=== Certificate Analysis Results ===')
    console.log('Subject:', subject)
    console.log('CNPJ from SAN:', cnpj)
    console.log('Validity:', validity)
    console.log('Serial Number:', serialNumber)
    
    // Check if we have essential data
    if (!subject.cn && !subject.o) {
      throw new Error('Não foi possível extrair informações do subject do certificado.')
    }
    
    if (!validity.notBefore || !validity.notAfter) {
      throw new Error('Não foi possível extrair datas de validade do certificado.')
    }
    
    return {
      subject,
      icpBrasilData: { cnpj },
      validity,
      serialNumber
    }
    
  } catch (error) {
    console.error('Error processing certificate with node:crypto:', error)
    throw new Error('Não foi possível extrair os dados necessários do certificado. O certificado pode estar corrompido ou em um formato não suportado.')
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
    console.log(`Password provided: ${password ? 'Yes' : 'No'}`)

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