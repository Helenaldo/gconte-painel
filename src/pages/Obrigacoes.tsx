import { useState, useEffect } from "react"
import { FileText, Download, Eye, Trash2, Upload, Search, Calendar, RefreshCw, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/context/auth-context"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ObligationDocument {
  id: string
  title: string
  description?: string
  file_url: string
  file_name: string
  file_size: number
  mime_type: string
  uploaded_by: string
  uploaded_at: string
  created_at: string
  updated_at: string
  uploader_name?: string
}

export function Obrigacoes() {
  const { toast } = useToast()
  const { profile } = useAuth()
  const [documents, setDocuments] = useState<ObligationDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedDocument, setSelectedDocument] = useState<ObligationDocument | null>(null)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof ObligationDocument>("uploaded_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const itemsPerPage = 10

  // Verificar se é administrador
  const isAdmin = profile?.role === 'administrador'

  const loadDocuments = async () => {
    console.debug('[Obrigacoes] Loading documents...')
    setLoading(true)
    try {
      let query = supabase
        .from('obligations_documents')
        .select(`
          id,
          title,
          description,
          file_url,
          file_name,
          file_size,
          mime_type,
          uploaded_by,
          uploaded_at,
          created_at,
          updated_at
        `)

      // Aplicar filtros de data se definidos
      if (startDate) {
        query = query.gte('uploaded_at', startDate)
      }
      if (endDate) {
        query = query.lte('uploaded_at', endDate + 'T23:59:59.999Z')
      }

      // Aplicar ordenação
      query = query.order(sortColumn, { ascending: sortDirection === 'asc' })

      const { data, error } = await query

      if (error) throw error

      // Buscar nomes dos uploaders separadamente
      const uploaderIds = Array.from(new Set(data?.map(doc => doc.uploaded_by)))
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', uploaderIds)

      const profilesMap = new Map(profiles?.map(p => [p.id, p.nome]) || [])

      // Processar dados para incluir nome do uploader
      const processedData = data?.map(doc => ({
        ...doc,
        uploader_name: profilesMap.get(doc.uploaded_by) || 'Usuário removido'
      })) || []

      setDocuments(processedData)
      console.debug('[Obrigacoes] Documents loaded successfully:', processedData.length)
    } catch (error: any) {
      console.error('[Obrigacoes] Error loading documents:', error)
      toast({
        title: "Erro ao carregar documentos",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (document: ObligationDocument) => {
    console.debug('[Obrigacoes] Deleting document:', document.id)
    try {
      const { error } = await supabase
        .from('obligations_documents')
        .delete()
        .eq('id', document.id)

      if (error) throw error

      toast({
        title: "Documento excluído",
        description: "O documento foi removido com sucesso."
      })

      loadDocuments()
    } catch (error: any) {
      console.error('[Obrigacoes] Error deleting document:', error)
      toast({
        title: "Erro ao excluir documento",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const handleDownload = async (document: ObligationDocument) => {
    console.debug('[Obrigacoes] Downloading document:', document.file_name)
    try {
      // Criar link temporário para download
      const link = window.document.createElement('a')
      link.href = document.file_url
      link.download = document.file_name
      link.target = '_blank'
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)

      toast({
        title: "Download iniciado",
        description: `Baixando ${document.file_name}`
      })
    } catch (error: any) {
      console.error('[Obrigacoes] Error downloading document:', error)
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o documento",
        variant: "destructive"
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const isRecentDocument = (uploadedAt: string) => {
    const uploadDate = new Date(uploadedAt)
    const now = new Date()
    const diffHours = (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60)
    return diffHours < 24
  }

  const handleSort = (column: keyof ObligationDocument) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage)
  const paginatedDocuments = filteredDocuments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  useEffect(() => {
    if (isAdmin) {
      loadDocuments()
    }
  }, [isAdmin, sortColumn, sortDirection])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, startDate, endDate])

  // Redirecionar se não for administrador
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Esta seção é acessível apenas para administradores.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Obrigações</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Obrigações (PDFs)</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie documentos PDF de obrigações tributárias e legais
        </p>
      </div>

      {/* Barra de ações */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, descrição ou nome do arquivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data inicial</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 w-40"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data final</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 w-40"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={loadDocuments} 
                disabled={loading}
                className="shrink-0"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button variant="outline" className="shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                Upload manual
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos ({filteredDocuments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Tipo</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('title')}
                  >
                    Título {sortColumn === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('uploaded_at')}
                  >
                    Enviado em {sortColumn === 'uploaded_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Enviado por</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('file_size')}
                  >
                    Tamanho {sortColumn === 'file_size' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Carregando...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {filteredDocuments.length === 0 && searchTerm ? 
                          "Nenhum documento encontrado para a busca." :
                          "Nenhum documento encontrado."
                        }
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDocuments.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <FileText className="h-5 w-5 text-destructive" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{document.title}</span>
                          {isRecentDocument(document.uploaded_at) && (
                            <Badge variant="secondary" className="text-xs">
                              Novo
                            </Badge>
                          )}
                        </div>
                        {document.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {document.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(document.uploaded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{document.uploader_name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatFileSize(document.file_size)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedDocument(document)
                              setShowPdfViewer(true)
                            }}
                            title="Visualizar PDF"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(document)}
                            title="Baixar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Excluir documento"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir documento</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o documento "{document.title}"? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(document)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
                {Math.min(currentPage * itemsPerPage, filteredDocuments.length)} de{' '}
                {filteredDocuments.length} documento(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm px-3 py-2">
                  {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de visualização do PDF */}
      <Dialog open={showPdfViewer} onOpenChange={setShowPdfViewer}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {selectedDocument && (
              <iframe
                src={selectedDocument.file_url}
                className="w-full h-full border-0 rounded-lg"
                title={selectedDocument.title}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => selectedDocument && handleDownload(selectedDocument)}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            <Button onClick={() => setShowPdfViewer(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}