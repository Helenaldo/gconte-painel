import React, { useState, useEffect } from "react"
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
import { toast } from "@/hooks/use-toast"
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
  const [certificados, setCertificados] = useState<CertificadoDigital[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedCertificado, setSelectedCertificado] = useState<CertificadoDigital | null>(null)
  const [uploading, setUploading] = useState(false)
  const [senha, setSenha] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    accept: {
      'application/x-pkcs12': ['.pfx', '.p12']
    },
    maxFiles: 1,
    onDrop: (files) => {
      if (files.length > 0) {
        handleFileUpload(files[0])
      }
    }
  })

  useEffect(() => {
    fetchCertificados()
    fetchClients()
  }, [])

  const fetchCertificados = async () => {
    try {
      const { data, error } = await supabase
        .from('certificados_digitais')
        .select(`
          *,
          clients (
            nome_empresarial,
            cnpj
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCertificados((data || []) as any)
    } catch (error) {
      console.error('Error fetching certificados:', error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar os certificados digitais.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nome_empresarial, cnpj')
        .order('nome_empresarial')

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!senha.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe a senha do certificado.",
        variant: "destructive",
      })
      return
    }

    setUploading(true)

    try {
      // Upload file to storage
      const fileName = `${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('certificados-digitais')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('certificados-digitais')
        .getPublicUrl(fileName)

      // Process certificate to extract info
      const formData = new FormData()
      formData.append('file', file)
      formData.append('password', senha)

      const response = await supabase.functions.invoke('process-certificate', {
        body: formData
      })

      if (response.error) {
        // Clean up uploaded file
        await supabase.storage.from('certificados-digitais').remove([fileName])
        
        toast({
          title: "Erro",
          description: response.error.message || "Erro ao processar certificado",
          variant: "destructive",
        })
        return
      }

      const certInfo = response.data

      // Find matching client by CNPJ
      const matchingClient = clients.find(client => 
        client.cnpj.replace(/\D/g, '') === certInfo.cnpj_certificado.replace(/\D/g, '')
      )

      if (!matchingClient) {
        // Clean up uploaded file
        await supabase.storage.from('certificados-digitais').remove([fileName])
        
        toast({
          title: "Cliente não encontrado",
          description: `Não foi encontrado um cliente cadastrado com o CNPJ ${certInfo.cnpj_certificado}. Cadastre o cliente antes de adicionar o certificado.`,
          variant: "destructive",
        })
        return
      }

      // Encrypt password (simple base64 for demo - use proper encryption in production)
      const senhaEncriptada = btoa(senha)

      // Save certificate info to database
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

      if (dbError) throw dbError

      toast({
        title: "Sucesso",
        description: `Certificado adicionado para ${matchingClient.nome_empresarial}`,
      })

      setUploadModalOpen(false)
      setSenha("")
      fetchCertificados()

    } catch (error) {
      console.error('Error uploading certificate:', error)
      toast({
        title: "Erro",
        description: "Não foi possível processar o certificado digital.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const getStatusInfo = (dataVencimento: string) => {
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
  }

  const handleDownload = async (certificado: CertificadoDigital) => {
    try {
      // Register audit
      await supabase.from('certificados_auditoria').insert({
        certificado_id: certificado.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        acao: 'download'
      })

      // Trigger download
      const link = document.createElement('a')
      link.href = certificado.url
      link.download = certificado.nome_arquivo
      link.click()

      toast({
        title: "Download iniciado",
        description: "O download do certificado foi iniciado.",
      })
    } catch (error) {
      console.error('Error downloading certificate:', error)
      toast({
        title: "Erro",
        description: "Não foi possível baixar o certificado.",
        variant: "destructive",
      })
    }
  }

  const handleViewDetails = async (certificado: CertificadoDigital) => {
    try {
      // Register audit
      await supabase.from('certificados_auditoria').insert({
        certificado_id: certificado.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        acao: 'visualizar'
      })

      setSelectedCertificado(certificado)
      setDetailsModalOpen(true)
    } catch (error) {
      console.error('Error viewing certificate details:', error)
    }
  }

  const handleDelete = async (certificado: CertificadoDigital) => {
    try {
      // Delete from storage
      const fileName = certificado.url.split('/').pop()
      if (fileName) {
        await supabase.storage.from('certificados-digitais').remove([fileName])
      }

      // Delete from database
      const { error } = await supabase
        .from('certificados_digitais')
        .delete()
        .eq('id', certificado.id)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Certificado digital excluído com sucesso!",
      })

      fetchCertificados()
    } catch (error) {
      console.error('Error deleting certificate:', error)
      toast({
        title: "Erro",
        description: "Não foi possível excluir o certificado.",
        variant: "destructive",
      })
    }
  }

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
        <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
          <DialogTrigger asChild>
            <Button>
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
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
                }`}
              >
                <input {...getInputProps()} />
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
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
                {acceptedFiles.length > 0 && (
                  <div className="mt-4 p-2 bg-muted rounded">
                    <p className="text-sm font-medium">{acceptedFiles[0].name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(acceptedFiles[0].size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                )}
              </div>
              {acceptedFiles.length > 0 && (
                <Button
                  onClick={() => handleFileUpload(acceptedFiles[0])}
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
            {certificados.length} certificado{certificados.length !== 1 ? 's' : ''} cadastrado{certificados.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {certificados.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhum certificado cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Adicione o primeiro certificado digital dos seus clientes.
              </p>
              <Button onClick={() => setUploadModalOpen(true)}>
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
                    <TableHead>Número de Série</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificados.map((certificado) => {
                    const statusInfo = getStatusInfo(certificado.data_vencimento)
                    const StatusIcon = statusInfo.icon

                    return (
                      <TableRow key={certificado.id}>
                        <TableCell className="font-medium">
                          {certificado.clients?.nome_empresarial || 'N/A'}
                        </TableCell>
                        <TableCell>{certificado.cnpj_certificado}</TableCell>
                        <TableCell>{certificado.emissor}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {certificado.numero_serie}
                        </TableCell>
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
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(certificado)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(certificado)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Certificado</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir este certificado digital? Esta ação não pode ser desfeita.
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
            <DialogTitle>Detalhes do Certificado Digital</DialogTitle>
            <DialogDescription>
              Informações completas do certificado selecionado
            </DialogDescription>
          </DialogHeader>
          {selectedCertificado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                  <p className="text-sm">{selectedCertificado.clients?.nome_empresarial || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">CNPJ</Label>
                  <p className="text-sm font-mono">{selectedCertificado.cnpj_certificado}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Emissor</Label>
                  <p className="text-sm">{selectedCertificado.emissor}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Número de Série</Label>
                  <p className="text-sm font-mono">{selectedCertificado.numero_serie}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data de Início</Label>
                  <p className="text-sm">{format(new Date(selectedCertificado.data_inicio), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data de Vencimento</Label>
                  <p className="text-sm">{format(new Date(selectedCertificado.data_vencimento), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Arquivo</Label>
                  <p className="text-sm">{selectedCertificado.nome_arquivo}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Tamanho</Label>
                  <p className="text-sm">{(selectedCertificado.tamanho / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={atob(selectedCertificado.senha_criptografada)}
                    readOnly
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => handleDownload(selectedCertificado)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={() => setDetailsModalOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}