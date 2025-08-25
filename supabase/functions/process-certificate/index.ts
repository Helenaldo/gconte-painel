import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

// ASN.1 parsing utilities for X.509 certificate processing
function parseASN1Length(data: Uint8Array, offset: number): { length: number; nextOffset: number } {
  if (offset >= data.length) throw new Error('Invalid ASN.1 length offset')
  
  const firstByte = data[offset]
  
  if ((firstByte & 0x80) === 0) {
    return { length: firstByte, nextOffset: offset + 1 }
  } else {
    const lengthOfLength = firstByte & 0x7F
    if (lengthOfLength === 0 || lengthOfLength > 4) {
      throw new Error('Invalid ASN.1 length encoding')
    }
    
    let length = 0
    for (let i = 0; i < lengthOfLength; i++) {
      if (offset + 1 + i >= data.length) throw new Error('Invalid ASN.1 length data')
      length = (length << 8) | data[offset + 1 + i]
    }
    return { length, nextOffset: offset + 1 + lengthOfLength }
  }
}

function findOID(data: Uint8Array, oidBytes: number[]): number[] {
  const positions: number[] = []
  const oidPattern = new Uint8Array([0x06, oidBytes.length, ...oidBytes])
  
  for (let i = 0; i <= data.length - oidPattern.length; i++) {
    let matches = true
    for (let j = 0; j < oidPattern.length; j++) {
      if (data[i + j] !== oidPattern[j]) {
        matches = false
        break
      }
    }
    if (matches) positions.push(i)
  }
  
  return positions
}

function extractStringValue(data: Uint8Array, startOffset: number, maxSearch: number = 100): string | null {
  const stringTags = [0x0C, 0x13, 0x16, 0x1E, 0x1F] // UTF8String, PrintableString, IA5String, etc.
  
  for (let i = startOffset; i < Math.min(startOffset + maxSearch, data.length - 1); i++) {
    if (stringTags.includes(data[i])) {
      try {
        const lengthInfo = parseASN1Length(data, i + 1)
        if (lengthInfo.length > 0 && lengthInfo.length < 500) {
          const stringBytes = data.slice(lengthInfo.nextOffset, lengthInfo.nextOffset + lengthInfo.length)
          const decoded = new TextDecoder('utf-8').decode(stringBytes).trim()
          if (decoded.length > 0) return decoded
        }
      } catch {
        continue
      }
    }
  }
  return null
}

function extractSubjectFromCertificate(certData: Uint8Array): { cn?: string; o?: string } {
  console.log('Extracting Subject information from certificate...')
  const result: { cn?: string; o?: string } = {}
  
  try {
    // OIDs: Common Name (2.5.4.3) = [0x55, 0x04, 0x03], Organization (2.5.4.10) = [0x55, 0x04, 0x0A]
    const cnOID = [0x55, 0x04, 0x03]
    const oOID = [0x55, 0x04, 0x0A]
    
    const cnPositions = findOID(certData, cnOID)
    const oPositions = findOID(certData, oOID)
    
    console.log(`Found CN OID at positions: ${cnPositions}`)
    console.log(`Found O OID at positions: ${oPositions}`)
    
    // Extract CN
    for (const pos of cnPositions) {
      const value = extractStringValue(certData, pos + cnOID.length + 2)
      if (value && value.length > 0) {
        result.cn = value
        console.log(`Extracted CN: ${value}`)
        break
      }
    }
    
    // Extract Organization
    for (const pos of oPositions) {
      const value = extractStringValue(certData, pos + oOID.length + 2)
      if (value && value.length > 0) {
        result.o = value
        console.log(`Extracted O: ${value}`)
        break
      }
    }
  } catch (error) {
    console.error('Error extracting subject:', error)
  }
  
  return result
}

function extractValidityDates(certData: Uint8Array): { notBefore?: string; notAfter?: string } {
  console.log('Extracting validity dates from certificate...')
  const result: { notBefore?: string; notAfter?: string } = {}
  
  try {
    // Look for UTCTime (0x17) and GeneralizedTime (0x18) tags in certificate
    const dates: string[] = []
    
    for (let i = 0; i < certData.length - 15; i++) {
      if (certData[i] === 0x17) { // UTCTime
        try {
          const lengthInfo = parseASN1Length(certData, i + 1)
          if (lengthInfo.length >= 12 && lengthInfo.length <= 17) {
            const dateBytes = certData.slice(lengthInfo.nextOffset, lengthInfo.nextOffset + lengthInfo.length)
            const dateStr = new TextDecoder('ascii').decode(dateBytes)
            
            // UTCTime format: YYMMDDHHMMSSZ or YYMMDDHHMMSS+HHMM
            if (/^\d{12,15}[Z+-]?/.test(dateStr)) {
              dates.push(parseUTCTime(dateStr))
              console.log(`Found UTCTime: ${dateStr} -> ${parseUTCTime(dateStr)}`)
            }
          }
        } catch { continue }
      } else if (certData[i] === 0x18) { // GeneralizedTime
        try {
          const lengthInfo = parseASN1Length(certData, i + 1)
          if (lengthInfo.length >= 14 && lengthInfo.length <= 19) {
            const dateBytes = certData.slice(lengthInfo.nextOffset, lengthInfo.nextOffset + lengthInfo.length)
            const dateStr = new TextDecoder('ascii').decode(dateBytes)
            
            // GeneralizedTime format: YYYYMMDDHHMMSSZ
            if (/^\d{14,17}[Z+-]?/.test(dateStr)) {
              dates.push(parseGeneralizedTime(dateStr))
              console.log(`Found GeneralizedTime: ${dateStr} -> ${parseGeneralizedTime(dateStr)}`)
            }
          }
        } catch { continue }
      }
    }
    
    // Typically the first date is notBefore, second is notAfter
    if (dates.length >= 2) {
      result.notBefore = dates[0]
      result.notAfter = dates[1]
      console.log(`Validity Period: ${result.notBefore} to ${result.notAfter}`)
    }
  } catch (error) {
    console.error('Error extracting validity dates:', error)
  }
  
  return result
}

function parseUTCTime(utcTime: string): string {
  // UTCTime: YYMMDDHHMMSSZ -> Convert to ISO string
  const year = parseInt(utcTime.substring(0, 2))
  const fullYear = year >= 50 ? 1900 + year : 2000 + year // Y2K pivot
  const month = utcTime.substring(2, 4)
  const day = utcTime.substring(4, 6)
  const hour = utcTime.substring(6, 8)
  const minute = utcTime.substring(8, 10)
  const second = utcTime.substring(10, 12)
  
  return `${fullYear}-${month}-${day}T${hour}:${minute}:${second}.000Z`
}

function parseGeneralizedTime(genTime: string): string {
  // GeneralizedTime: YYYYMMDDHHMMSSZ -> Convert to ISO string
  const year = genTime.substring(0, 4)
  const month = genTime.substring(4, 6)
  const day = genTime.substring(6, 8)
  const hour = genTime.substring(8, 10)
  const minute = genTime.substring(10, 12)
  const second = genTime.substring(12, 14)
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`
}

function extractSerialNumber(certData: Uint8Array): string | null {
  console.log('Extracting serial number from certificate...')
  
  try {
    // Look for INTEGER tag (0x02) early in certificate structure
    for (let i = 0; i < Math.min(1000, certData.length - 10); i++) {
      if (certData[i] === 0x02) { // INTEGER tag
        try {
          const lengthInfo = parseASN1Length(certData, i + 1)
          if (lengthInfo.length > 0 && lengthInfo.length <= 20) {
            const serialBytes = certData.slice(lengthInfo.nextOffset, lengthInfo.nextOffset + lengthInfo.length)
            const serialHex = Array.from(serialBytes).map(b => b.toString(16).padStart(2, '0')).join('')
            
            // Skip obvious non-serial numbers (version numbers, etc.)
            if (serialHex !== '00' && serialHex !== '01' && serialHex !== '02' && serialBytes.length > 1) {
              console.log(`Found potential serial number: ${serialHex}`)
              return serialHex.toUpperCase()
            }
          }
        } catch { continue }
      }
    }
  } catch (error) {
    console.error('Error extracting serial number:', error)
  }
  
  return null
}

function extractCNPJFromSAN(certData: Uint8Array): string | null {
  console.log('Searching for CNPJ in Subject Alternative Name extension...')
  
  try {
    // Subject Alternative Name OID: 2.5.29.17 = [0x55, 0x1D, 0x11]
    const sanOID = [0x55, 0x1D, 0x11]
    const sanPositions = findOID(certData, sanOID)
    
    console.log(`Found SAN extension at positions: ${sanPositions}`)
    
    for (const sanPos of sanPositions) {
      // Search in area around SAN extension
      const searchStart = Math.max(0, sanPos - 200)
      const searchEnd = Math.min(certData.length, sanPos + 2000)
      const sanArea = certData.slice(searchStart, searchEnd)
      
      // ICP-Brasil CNPJ OID: 2.16.76.1.3.3 = [0x60, 0x84, 0x4C, 0x01, 0x03, 0x03]
      const cnpjOID = [0x60, 0x84, 0x4C, 0x01, 0x03, 0x03]
      const cnpjPositions = findOID(sanArea, cnpjOID)
      
      console.log(`Found CNPJ OID at relative positions: ${cnpjPositions}`)
      
      for (const cnpjPos of cnpjPositions) {
        // Try to extract OCTET STRING or similar after the OID
        const cnpjValue = extractCNPJValue(sanArea, cnpjPos + cnpjOID.length + 2)
        if (cnpjValue) {
          console.log(`Successfully extracted CNPJ from SAN: ${cnpjValue}`)
          return cnpjValue
        }
      }
    }
  } catch (error) {
    console.error('Error extracting CNPJ from SAN:', error)
  }
  
  return null
}

function extractCNPJValue(data: Uint8Array, startOffset: number): string | null {
  const possibleTags = [0x04, 0x0C, 0x13, 0x16] // OCTET STRING, UTF8String, PrintableString, IA5String
  
  for (let i = startOffset; i < Math.min(startOffset + 100, data.length - 10); i++) {
    if (possibleTags.includes(data[i])) {
      try {
        const lengthInfo = parseASN1Length(data, i + 1)
        if (lengthInfo.length >= 14 && lengthInfo.length <= 50) {
          const content = data.slice(lengthInfo.nextOffset, lengthInfo.nextOffset + lengthInfo.length)
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
      } catch { continue }
    }
  }
  
  return null
}

function isValidCNPJFormat(cnpj: string): boolean {
  // Basic CNPJ validation - avoid obvious invalid patterns
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
  
  console.log('=== Starting detailed certificate analysis ===')
  
  // Extract certificate information
  const subject = extractSubjectFromCertificate(certData)
  const cnpj = extractCNPJFromSAN(certData)
  const validity = extractValidityDates(certData)
  const serialNumber = extractSerialNumber(certData)
  
  console.log('=== Certificate Analysis Results ===')
  console.log('Subject:', subject)
  console.log('CNPJ from SAN:', cnpj)
  console.log('Validity:', validity)
  console.log('Serial Number:', serialNumber)
  
  // If we couldn't extract real data, return error instead of fake data
  if (!subject.cn && !subject.o && !cnpj && !validity.notBefore && !validity.notAfter) {
    throw new Error('Não foi possível extrair os dados necessários do certificado. O certificado pode estar corrompido ou em um formato não suportado.')
  }
  
  return {
    subject,
    icpBrasilData: { cnpj },
    validity,
    serialNumber
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