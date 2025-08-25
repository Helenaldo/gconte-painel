import React, { useState, useEffect, useCallback, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { Eye, EyeOff, Download, Edit, Trash2, Info, Upload, Shield, AlertTriangle, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface CertificadoDigital {
  id: string
  client_id: string
  nome_arquivo: string
  url: string
  senha_criptografada: string
  cnpj_certificado: string
  emissor: string
  numero_serie: string
  data_inicio: string
  data_vencimento: string
  tamanho: number
  created_at: string
  clients?: {
    nome_empresarial: string
    cnpj: string
  } | null
}

interface Client {
  id: string
  nome_empresarial: string
  cnpj: string
}

export default function CertificadosDigitais() {
  console.debug('[CertificadosDigitais] Component initializing')
  
  const { toast } = useToast()
  const [certificados, setCertificados] = useState<CertificadoDigital[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedCertificado, setSelectedCertificado] = useState<CertificadoDigital | null>(null)
  const [uploading, setUploading] = useState(false)
  const [senha, setSenha] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  
  // Component mounted flag to prevent state updates after unmount
  const mountedRef = useRef(true)
  
  // Safe state updater
  const safeSetState = useCallback((setter: () => void) => {
    if (mountedRef.current) {
      try {
        setter()
      } catch (error) {
        console.error('[CertificadosDigitais] Error updating state:', error)
      }
    }
  }, [])

  // Safe toast function with error handling
  const safeToast = useCallback((options: Parameters<typeof toast>[0]) => {
    if (mountedRef.current) {
      try {
        console.debug('[CertificadosDigitais] Showing toast:', options)
        toast(options)
      } catch (error) {
        console.error('[CertificadosDigitais] Error showing toast:', error)
      }
    }
  }, [toast])

  // File upload handler - moved here to prevent dropzone initialization issues
  const handleFileUpload = useCallback(async (file: File) => {
    console.debug('[CertificadosDigitais] handleFileUpload - start:', {
      fileName: file.name,
      fileSize: file.size,
      hasPassword: Boolean(senha.trim())
    })

    if (!senha.trim()) {
      console.warn('[CertificadosDigitais] handleFileUpload - password missing')
      safeToast({
        title: "Erro",
        description: "Por favor, informe a senha do certificado.",
        variant: "destructive",
      })
      return
    }

    safeSetState(() => setUploading(true))

    try {
      // Upload file to storage
      const fileName = `${Date.now()}-${file.name}`
      console.debug('[CertificadosDigitais] handleFileUpload - uploading file:', fileName)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('certificados-digitais')
        .upload(fileName, file)

      if (uploadError) {
        console.error('[CertificadosDigitals] handleFileUpload - upload error:', uploadError)
        throw uploadError
      }

      console.debug('[CertificadosDigitais] handleFileUpload - file uploaded successfully')

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('certificados-digitais')
        .getPublicUrl(fileName)

      console.debug('[CertificadosDigitais] handleFileUpload - got public URL:', publicUrl)
      
      // Process certificate to extract info
      const formData = new FormData()
      formData.append('file', file)
      formData.append('password', senha)

      console.debug('[CertificadosDigitais] handleFileUpload - calling process-certificate function')
      
      // Use fetch to ensure proper multipart/form-data handling
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('https://heeqpvphsgnyqwpnqpgt.supabase.co/functions/v1/process-certificate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZXFwdnBoc2dueXF3cG5xcGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODA1NDYsImV4cCI6MjA2OTQ1NjU0Nn0.ycheHGEGUTjMbiShhI10josr4AvfyENb5Hs2V5Cqd58',
          // Don't set Content-Type manually - let the browser set it for multipart/form-data
        },
        body: formData
      })

      console.debug('[CertificadosDigitais] handleFileUpload - function response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[CertificadosDigitais] handleFileUpload - function error:', errorText)
        
        // Clean up uploaded file
        await supabase.storage.from('certificados-digitais').remove([fileName])
        
        let errorMessage = "Erro ao processar certificado"
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }
        
        safeToast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      const certInfo = await response.json()
      console.debug('[CertificadosDigitais] handleFileUpload - certificate info extracted:', certInfo)

      // Find matching client by CNPJ
      const matchingClient = clients.find(client => 
        client.cnpj.replace(/\D/g, '') === certInfo.cnpj_certificado.replace(/\D/g, '')
      )

      console.debug('[CertificadosDigitais] handleFileUpload - matching client:', matchingClient)

      if (!matchingClient) {
        console.warn('[CertificadosDigitais] handleFileUpload - client not found for CNPJ:', certInfo.cnpj_certificado)
        
        // Clean up uploaded file
        await supabase.storage.from('certificados-digitais').remove([fileName])
        
        safeToast({
          title: "Cliente não encontrado",
          description: `Não foi encontrado um cliente cadastrado com o CNPJ ${certInfo.cnpj_certificado}. Cadastre o cliente antes de adicionar o certificado.`,
          variant: "destructive",
        })
        return
      }

      // Check if there's an existing certificate for this client and delete it
      console.debug('[CertificadosDigitais] handleFileUpload - checking for existing certificates')
      const { data: existingCerts } = await supabase
        .from('certificados_digitais')
        .select('*')
        .eq('client_id', matchingClient.id)

      if (existingCerts && existingCerts.length > 0) {
        console.debug('[CertificadosDigitais] handleFileUpload - replacing existing certificates:', existingCerts.length)
        
        for (const existingCert of existingCerts) {
          try {
            // Delete file from storage
            const existingFileName = existingCert.url.split('/').pop()
            if (existingFileName) {
              await supabase.storage.from('certificados-digitais').remove([existingFileName])
            }
            
            // Delete from database
            await supabase
              .from('certificados_digitais')
              .delete()
              .eq('id', existingCert.id)
          } catch (error) {
            console.error('[CertificadosDigitais] handleFileUpload - error deleting existing cert:', error)
          }
        }
      }

      // Encrypt password (simple base64 for demo - use proper encryption in production)
      const senhaEncriptada = btoa(senha)

      // Save certificate info to database
      console.debug('[CertificadosDigitais] handleFileUpload - saving to database')
      const { error: dbError } = await supabase
        .from('certificados_digitais')
        .insert({
          client_id: matchingClient.id,
          nome_arquivo: file.name,
          url: publicUrl,
          senha_criptografada: senhaEncriptada,
          cnpj_certificado: certInfo.cnpj_certificado,
          emissor: certInfo.emissor,
          numero_serie: certInfo.numero_serie,
          data_inicio: certInfo.data_inicio,
          data_vencimento: certInfo.data_vencimento,
          tamanho: file.size,
          mime_type: file.type
        })

      if (dbError) {
        console.error('[CertificadosDigitals] handleFileUpload - database error:', dbError)
        throw dbError
      }

      console.debug('[CertificadosDigitais] handleFileUpload - success')
      safeToast({
        title: "Sucesso",
        description: `Certificado adicionado para ${matchingClient.nome_empresarial}`,
      })

      handleModalClose()
      fetchCertificados()

    } catch (error) {
      console.error('[CertificadosDigitais] handleFileUpload - unexpected error:', error)
      safeToast({
        title: "Erro",
        description: "Não foi possível processar o certificado digital.",
        variant: "destructive",
      })
    } finally {
      safeSetState(() => setUploading(false))
    }
  }, [senha, clients, safeToast, safeSetState])

  // Dropzone configuration with safe initialization
  const [dropzoneProps, setDropzoneProps] = useState<any>({})

  // Initialize dropzone hook once with safe defaults
  const dropzone = useDropzone({
    accept: {
      'application/x-pkcs12': ['.pfx', '.p12']
    },
    maxFiles: 1,
    onDrop: (files: File[]) => {
      console.debug('[CertificadosDigitais] Files dropped:', files.length)
      if (files.length > 0) {
        handleFileUpload(files[0])
      }
    }
  })

  useEffect(() => {
    // Set dropzone props after initialization
    if (dropzone) {
      setDropzoneProps({
        getRootProps: dropzone.getRootProps,
        getInputProps: dropzone.getInputProps,
        isDragActive: dropzone.isDragActive,
        acceptedFiles: dropzone.acceptedFiles || []
      })
    }
  }, [dropzone, dropzone.isDragActive, dropzone.acceptedFiles])

  // Cleanup function
  useEffect(() => {
    return () => {
      console.debug('[CertificadosDigitais] Component unmounting')
      mountedRef.current = false
    }
  }, [])

  const fetchCertificados = async () => {
    console.debug('[CertificadosDigitais] fetchCertificados - start')
    
    try {
      const { data, error } = await supabase
        .from('certificados_digitais')
        .select(`
          *,
          clients!certificados_digitais_client_id_fkey (
            nome_empresarial,
            cnpj
          )
        `)
        .order('created_at', { ascending: false })

      console.debug('[CertificadosDigitais] fetchCertificados - response:', { data: data?.length, error })

      if (error) throw error
      
      safeSetState(() => {
        setCertificados((data || []) as any)
      })
    } catch (error) {
      console.error('[CertificadosDigitais] fetchCertificados - error:', error)
      safeToast({
        title: "Erro",
        description: "Não foi possível carregar os certificados digitais.",
        variant: "destructive",
      })
    } finally {
      safeSetState(() => {
        setLoading(false)
      })
    }
  }

  const fetchClients = async () => {
    console.debug('[CertificadosDigitais] fetchClients - start')
    
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nome_empresarial, cnpj')
        .order('nome_empresarial')

      console.debug('[CertificadosDigitais] fetchClients - response:', { data: data?.length, error })

      if (error) throw error
      
      safeSetState(() => {
        setClients(data || [])
      })
    } catch (error) {
      console.error('[CertificadosDigitais] fetchClients - error:', error)
    }
  }

  useEffect(() => {
    console.debug('[CertificadosDigitais] Initial data fetch')
    fetchCertificados()
    fetchClients()
  }, [])

  const handleModalOpen = useCallback(() => {
    console.debug('[CertificadosDigitais] handleModalOpen - opening modal')
    
    try {
      safeSetState(() => {
        setUploadModalOpen(true)
        setSenha("")
        setShowPassword(false)
      })
    } catch (error) {
      console.error('[CertificadosDigitais] handleModalOpen - error:', error)
    }
  }, [safeSetState])

  const handleModalClose = useCallback(() => {
    console.debug('[CertificadosDigitais] handleModalClose - closing modal')
    
    try {
      safeSetState(() => {
        setUploadModalOpen(false)
        setSenha("")
        setShowPassword(false)
        setUploading(false)
      })
      
      // Reset dropzone state completely
      if (dropzone) {
        // Reset input file value
        if (dropzone.inputRef && dropzone.inputRef.current) {
          dropzone.inputRef.current.value = ''
          dropzone.inputRef.current.files = null
        }
        
        // Force re-render of dropzone props with fresh state
        setDropzoneProps({
          getRootProps: dropzone.getRootProps,
          getInputProps: dropzone.getInputProps,
          isDragActive: false,
          acceptedFiles: []
        })
      } else {
        // Fallback: reset dropzone props to empty state
        setDropzoneProps({})
      }
      
      console.debug('[CertificadosDigitais] handleModalClose - dropzone reset complete')
    } catch (error) {
      console.error('[CertificadosDigitais] handleModalClose - error:', error)
    }
  }, [safeSetState, dropzone])


  const getStatusInfo = (dataVencimento: string) => {
    try {
      const vencimento = new Date(dataVencimento)
      const hoje = new Date()
      const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

      if (diasRestantes < 0) {
        return { status: 'vencido', label: 'Vencido', variant: 'destructive' as const, icon: AlertTriangle }
      } else if (diasRestantes <= 30) {
        return { status: 'vencendo', label: 'Vencendo', variant: 'warning' as const, icon: AlertTriangle }
      } else {
        return { status: 'valido', label: 'Válido', variant: 'success' as const, icon: CheckCircle }
      }
    } catch (error) {
      console.error('[CertificadosDigitais] getStatusInfo - error:', error)
      return { status: 'erro', label: 'Erro', variant: 'destructive' as const, icon: AlertTriangle }
    }
  }

  const handleDownload = async (certificado: CertificadoDigital) => {
    console.debug('[CertificadosDigitais] handleDownload - start:', certificado.nome_arquivo)
    
    try {
      // Register audit
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user?.id) {
        await supabase.from('certificados_auditoria').insert({
          certificado_id: certificado.id,
          user_id: userData.user.id,
          acao: 'download'
        })
      }

      // Trigger download
      const link = document.createElement('a')
      link.href = certificado.url
      link.download = certificado.nome_arquivo
      link.click()

      console.debug('[CertificadosDigitais] handleDownload - success')
      safeToast({
        title: "Download iniciado",
        description: "O download do certificado foi iniciado.",
      })
    } catch (error) {
      console.error('[CertificadosDigitais] handleDownload - error:', error)
      safeToast({
        title: "Erro",
        description: "Não foi possível baixar o certificado.",
        variant: "destructive",
      })
    }
  }

  const handleViewDetails = async (certificado: CertificadoDigital) => {
    console.debug('[CertificadosDigitais] handleViewDetails - start:', certificado.id)
    
    try {
      // Register audit
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user?.id) {
        await supabase.from('certificados_auditoria').insert({
          certificado_id: certificado.id,
          user_id: userData.user.id,
          acao: 'visualizar'
        })
      }

      safeSetState(() => {
        setSelectedCertificado(certificado)
        setDetailsModalOpen(true)
      })
    } catch (error) {
      console.error('[CertificadosDigitais] handleViewDetails - error:', error)
    }
  }

  const handleDelete = async (certificado: CertificadoDigital) => {
    console.debug('[CertificadosDigitais] handleDelete - start:', certificado.id)
    
    try {
      // Delete from storage
      const fileName = certificado.url.split('/').pop()
      if (fileName) {
        console.debug('[CertificadosDigitais] handleDelete - removing from storage:', fileName)
        await supabase.storage.from('certificados-digitais').remove([fileName])
      }

      // Delete from database
      console.debug('[CertificadosDigitais] handleDelete - removing from database')
      const { error } = await supabase
        .from('certificados_digitais')
        .delete()
        .eq('id', certificado.id)

      if (error) throw error

      console.debug('[CertificadosDigitais] handleDelete - success')
      safeToast({
        title: "Sucesso",
        description: "Certificado digital excluído com sucesso!",
      })

      fetchCertificados()
    } catch (error) {
      console.error('[CertificadosDigitais] handleDelete - error:', error)
      safeToast({
        title: "Erro",
        description: "Não foi possível excluir o certificado.",
        variant: "destructive",
      })
    }
  }

  const togglePasswordVisibility = useCallback(() => {
    console.debug('[CertificadosDigitais] togglePasswordVisibility')
    
    try {
      safeSetState(() => {
        setShowPassword(prev => !prev)
      })
      
      // Register audit for password visibility
      if (selectedCertificado && showPassword) {
        supabase.auth.getUser().then(({ data: userData }) => {
          if (userData.user?.id) {
            supabase.from('certificados_auditoria').insert({
              certificado_id: selectedCertificado.id,
              user_id: userData.user.id,
              acao: 'visualizar_senha'
            })
          }
        })
      }
    } catch (error) {
      console.error('[CertificadosDigitails] togglePasswordVisibility - error:', error)
    }
  }, [safeSetState, selectedCertificado, showPassword])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Certificados Digitais</h1>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-full mb-4"></div>
          <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Certificados Digitais</h1>
          <p className="text-muted-foreground">
            Gerencie os certificados digitais dos seus clientes
          </p>
        </div>
        <Dialog open={uploadModalOpen} onOpenChange={(open) => {
          if (open) {
            handleModalOpen()
          } else {
            handleModalClose()
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleModalOpen}>
              <Upload className="h-4 w-4 mr-2" />
              Adicionar Certificado
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Adicionar Certificado Digital</DialogTitle>
              <DialogDescription>
                Faça upload de um certificado digital (.pfx ou .p12) e informe a senha.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="senha">Senha do Certificado</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite a senha do certificado"
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={togglePasswordVisibility}
                    disabled={uploading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div
                {...(dropzoneProps.getRootProps ? dropzoneProps.getRootProps() : {})}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dropzoneProps.isDragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
                } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input {...(dropzoneProps.getInputProps ? dropzoneProps.getInputProps() : {})} disabled={uploading} />
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {dropzoneProps.isDragActive ? (
                  <p>Solte o arquivo aqui...</p>
                ) : (
                  <div>
                    <p className="mb-2">
                      Arraste e solte um certificado aqui, ou clique para selecionar
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Apenas arquivos .pfx e .p12 são aceitos
                    </p>
                  </div>
                )}
                {(dropzoneProps.acceptedFiles || []).length > 0 && (
                  <div className="mt-4 p-2 bg-muted rounded">
                    <p className="text-sm font-medium">{(dropzoneProps.acceptedFiles || [])[0]?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {((dropzoneProps.acceptedFiles || [])[0]?.size / 1024)?.toFixed(1)} KB
                    </p>
                  </div>
                )}
              </div>
              {(dropzoneProps.acceptedFiles || []).length > 0 && (
                <Button
                  onClick={() => handleFileUpload((dropzoneProps.acceptedFiles || [])[0])}
                  disabled={uploading || !senha.trim()}
                  className="w-full"
                >
                  {uploading ? "Processando..." : "Adicionar Certificado"}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Certificados</CardTitle>
          <CardDescription>
            {(certificados?.length || 0)} certificado{(certificados?.length || 0) !== 1 ? 's' : ''} cadastrado{(certificados?.length || 0) !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!certificados || certificados.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhum certificado cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Adicione o primeiro certificado digital dos seus clientes.
              </p>
              <Button onClick={handleModalOpen}>
                <Upload className="h-4 w-4 mr-2" />
                Adicionar Certificado
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Emissor</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(certificados || []).map((certificado) => {
                    const statusInfo = getStatusInfo(certificado.data_vencimento)
                    const StatusIcon = statusInfo.icon

                    return (
                      <TableRow key={certificado.id}>
                        <TableCell className="font-medium">
                          {certificado.clients?.nome_empresarial || 'N/A'}
                        </TableCell>
                        <TableCell>{certificado.cnpj_certificado}</TableCell>
                        <TableCell>{certificado.emissor}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Início: {format(new Date(certificado.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}</div>
                            <div>Fim: {format(new Date(certificado.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant} className="flex items-center gap-1 w-fit">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewDetails(certificado)}
                                  >
                                    <Info className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver detalhes</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownload(certificado)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Baixar certificado</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <AlertDialog>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir certificado</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir o certificado digital "{certificado.nome_arquivo}"? 
                                    Esta ação não pode ser desfeita e o arquivo será removido permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDelete(certificado)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Certificado</DialogTitle>
            <DialogDescription>
              Informações completas do certificado digital
            </DialogDescription>
          </DialogHeader>
          {selectedCertificado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Cliente</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedCertificado.clients?.nome_empresarial || 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">CNPJ</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedCertificado.cnpj_certificado}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Emissor</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedCertificado.emissor}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Arquivo</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedCertificado.nome_arquivo}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Data de Início</Label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedCertificado.data_inicio), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Data de Vencimento</Label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedCertificado.data_vencimento), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Tamanho</Label>
                  <p className="text-sm text-muted-foreground">
                    {(selectedCertificado.tamanho / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    {(() => {
                      const statusInfo = getStatusInfo(selectedCertificado.data_vencimento)
                      const StatusIcon = statusInfo.icon
                      return (
                        <Badge variant={statusInfo.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      )
                    })()}
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Senha</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={selectedCertificado.senha_criptografada ? atob(selectedCertificado.senha_criptografada) : ''}
                    readOnly
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={togglePasswordVisibility}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}