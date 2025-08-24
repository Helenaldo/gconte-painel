import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Search, Download, Trash2, Eye, Upload, RefreshCw, Calendar, FileText, AlertCircle, X, Key, Settings } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ObligationDocument {
  id: string;
  titulo: string;
  descricao?: string;
  arquivo_nome: string;
  tamanho_bytes: number;
  mime: string;
  url_download: string;
  enviado_em: string;
  criado_em: string;
  enviado_por?: string;
}

interface PaginationInfo {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export default function Obrigacoes() {
  const { user, isAdmin, session } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<ObligationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof ObligationDocument>('criado_em');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [dateFilter, setDateFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  
  // Upload modal states
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Credenciais de autenticação
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [showLoginGuide, setShowLoginGuide] = useState(false);

  // Verificar se não é administrador e redirecionar
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Esta seção é acessível apenas para administradores.
          </p>
        </div>
      </div>
    );
  }

  // Função para carregar documentos via API
  const loadDocuments = async () => {
    if (!isAdmin || !credentials.email || !credentials.password) {
      if ((!credentials.email || !credentials.password) && !showLoginGuide) {
        setShowLoginGuide(true);
      }
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: itemsPerPage.toString(),
        order_by: sortColumn,
        order: sortDirection
      });

      if (searchTerm) params.append('q', searchTerm);
      if (startDate) params.append('data_ini', startDate);
      if (endDate) params.append('data_fim', endDate);

      const authHeader = 'Basic ' + btoa(`${credentials.email}:${credentials.password}`);
      
      const response = await fetch(`https://heeqpvphsgnyqwpnqpgt.supabase.co/functions/v1/api-obrigacoes-list?${params}`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao carregar documentos');
      }

      const data = await response.json();
      setDocuments(data.data || []);
      setPagination(data.pagination);
      setShowLoginGuide(false);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao carregar documentos",
        variant: "destructive"
      });
      
      // Se erro de autenticação, mostrar guia do login
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        setShowLoginGuide(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Função para upload de documento
  const handleUpload = async () => {
    if (!uploadFile || !credentials.email || !credentials.password) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('pdf', uploadFile);
      if (uploadTitle) formData.append('titulo', uploadTitle);
      if (uploadDescription) formData.append('descricao', uploadDescription);

      // Simular progresso
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const authHeader = 'Basic ' + btoa(`${credentials.email}:${credentials.password}`);
      
      const response = await fetch(`https://heeqpvphsgnyqwpnqpgt.supabase.co/functions/v1/api-obrigacoes-upload`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader
        },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro no upload');
      }

      const result = await response.json();
      
      toast({
        title: "Sucesso",
        description: "Documento enviado com sucesso!"
      });

      // Resetar modal e recarregar lista
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      setUploadProgress(0);
      loadDocuments();
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha no upload",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Função para deletar documento
  const handleDelete = async (document: ObligationDocument) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${document.titulo}"?`)) {
      return;
    }

    if (!credentials.email || !credentials.password) return;

    try {
      const authHeader = 'Basic ' + btoa(`${credentials.email}:${credentials.password}`);
      
      const response = await fetch(`https://heeqpvphsgnyqwpnqpgt.supabase.co/functions/v1/api-obrigacoes-delete/${document.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao excluir documento');
      }

      toast({
        title: "Sucesso",
        description: "Documento excluído com sucesso!"
      });

      // Recarregar a lista
      loadDocuments();
    } catch (error) {
      console.error('Erro ao deletar documento:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao excluir documento",
        variant: "destructive"
      });
    }
  };

  // Função para fazer download do documento
  const handleDownload = (document: ObligationDocument) => {
    if (!credentials.email || !credentials.password) return;
    
    // Criar link de download com autenticação via query param ou abrir em nova aba
    const downloadUrl = `https://heeqpvphsgnyqwpnqpgt.supabase.co/functions/v1/api-obrigacoes-download/${document.id}`;
    
    // Abrir em nova aba com header de autenticação
    const authHeader = 'Basic ' + btoa(`${credentials.email}:${credentials.password}`);
    const newWindow = window.open();
    if (newWindow) {
      fetch(downloadUrl, {
        headers: {
          'Authorization': authHeader
        }
      })
      .then(response => response.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = document.arquivo_nome;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);
        newWindow.close();
      })
      .catch(error => {
        console.error('Erro no download:', error);
        toast({
          title: "Erro",
          description: "Falha no download do documento",
          variant: "destructive"
        });
        newWindow.close();
      });
    }
  };

  // Função para formatar tamanho do arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Função para verificar se é documento recente (últimas 24h)
  const isRecentDocument = (uploadedAt: string): boolean => {
    const uploadDate = parseISO(uploadedAt);
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    return isAfter(uploadDate, twentyFourHoursAgo);
  };

  // Função para validar arquivo
  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Apenas arquivos PDF são permitidos';
    }
    
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      return 'Arquivo muito grande. Máximo permitido: 20MB';
    }
    
    return null;
  };

  // Handler para seleção de arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      });
      e.target.value = '';
      return;
    }

    setUploadFile(file);
    if (!uploadTitle) {
      setUploadTitle(file.name.replace('.pdf', ''));
    }
  };

  // Função para lidar com ordenação
  const handleSort = (column: keyof ObligationDocument) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset para primeira página
  };

  // Effect para carregar dados
  useEffect(() => {
    if (user && isAdmin && credentials.email && credentials.password) {
      loadDocuments();
    }
  }, [user, isAdmin, credentials.email, credentials.password, currentPage, sortColumn, sortDirection, searchTerm, startDate, endDate]);

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        loadDocuments();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

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

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Obrigações (PDFs)</h1>
        <p className="text-muted-foreground">
          Gerencie documentos PDF de obrigações tributárias e legais
        </p>
      </div>

      {/* Login Guide Card */}
      {showLoginGuide && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <Key className="h-5 w-5" />
              Autenticação Necessária
            </CardTitle>
            <CardDescription className="text-orange-700">
              Para acessar os documentos de obrigações, você precisa se autenticar com suas credenciais.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-orange-700">
                <strong>Para acessar:</strong>
              </p>
              <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                <li>Use seu <strong>email e senha</strong> do sistema</li>
                <li>As mesmas credenciais que você usa para entrar no aplicativo</li>
                <li>Seus dados são seguros e criptografados</li>
              </ul>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setLoginModalOpen(true)}
                  className="text-orange-700 border-orange-300 hover:bg-orange-100"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Configurar Credenciais
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowLoginGuide(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Login Configuration Modal */}
      <Dialog open={loginModalOpen} onOpenChange={setLoginModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Credenciais</DialogTitle>
            <DialogDescription>
              Digite seu email e senha para acessar os documentos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                placeholder="seu@email.com"
              />
            </div>
            
            <div>
              <Label htmlFor="login-password">Senha</Label>
              <Input
                id="login-password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Sua senha"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use as mesmas credenciais do aplicativo
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setLoginModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  setLoginModalOpen(false);
                  if (credentials.email && credentials.password) {
                    loadDocuments();
                  }
                }}
                disabled={!credentials.email.trim() || !credentials.password.trim()}
              >
                Salvar Credenciais
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Actions Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              <Button 
                onClick={loadDocuments} 
                variant="outline" 
                size="sm"
                className="gap-2"
                disabled={loading || !credentials.email || !credentials.password}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setLoginModalOpen(true)}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Credenciais
              </Button>
            </div>
            
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="default" 
                  size="sm"
                  className="gap-2"
                  disabled={!credentials.email || !credentials.password}
                >
                  <Upload className="h-4 w-4" />
                  Enviar PDF
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Enviar Documento PDF</DialogTitle>
                  <DialogDescription>
                    Selecione um arquivo PDF e preencha as informações do documento.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="pdf-file">Arquivo PDF *</Label>
                    <Input
                      id="pdf-file"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                    {uploadFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {uploadFile.name} ({formatFileSize(uploadFile.size)})
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="upload-title">Título</Label>
                    <Input
                      id="upload-title"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Digite o título do documento"
                      disabled={uploading}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="upload-description">Descrição (opcional)</Label>
                    <Textarea
                      id="upload-description"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="Digite uma descrição para o documento"
                      disabled={uploading}
                      rows={3}
                    />
                  </div>
                  
                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Enviando...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setUploadModalOpen(false)}
                      disabled={uploading}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleUpload}
                      disabled={!uploadFile || uploading}
                    >
                      {uploading ? 'Enviando...' : 'Enviar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mt-6">
            <div className="flex-1">
              <Label htmlFor="search">Buscar documentos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por título, descrição ou nome do arquivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-2">
              <div>
                <Label htmlFor="start-date">Data inicial</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-auto"
                />
              </div>
              
              <div>
                <Label htmlFor="end-date">Data final</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos
            {pagination && (
              <Badge variant="secondary">
                {pagination.total}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16">Tipo</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('titulo')}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Título
                      {sortColumn === 'titulo' && (
                        <span className="text-xs">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('enviado_em')}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Data de Envio
                      {sortColumn === 'enviado_em' && (
                        <span className="text-xs">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Enviado por</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <span>Nenhum documento encontrado</span>
                        {searchTerm && (
                          <span className="text-sm">
                            Tente ajustar os filtros de busca
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-500" />
                          <span className="text-sm">PDF</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{document.titulo}</span>
                            {isRecentDocument(document.enviado_em) && (
                              <Badge variant="secondary" className="text-xs">
                                Novo
                              </Badge>
                            )}
                          </div>
                          {document.descricao && (
                            <span className="text-xs text-muted-foreground">
                              {document.descricao}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(document.enviado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{document.enviado_por || 'Sistema'}</TableCell>
                      <TableCell>{formatFileSize(document.tamanho_bytes)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedPdf(document.url_download)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh]">
                              <DialogHeader>
                                <DialogTitle className="flex items-center justify-between">
                                  {document.titulo}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedPdf(null)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </DialogTitle>
                              </DialogHeader>
                              <div className="w-full h-[70vh]">
                                {selectedPdf && (
                                  <iframe
                                    src={`${selectedPdf}#toolbar=1`}
                                    className="w-full h-full border-0 rounded"
                                    title="Visualizador de PDF"
                                  />
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDownload(document)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDelete(document)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {pagination && pagination.total > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Mostrando {((pagination.page - 1) * pagination.per_page) + 1} a {Math.min(pagination.page * pagination.per_page, pagination.total)} de {pagination.total} documentos
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={!pagination.has_prev || loading}
                >
                  Anterior
                </Button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                    const startPage = Math.max(1, pagination.page - 2);
                    return startPage + i;
                  })
                    .filter(page => page <= pagination.total_pages)
                    .map(page => (
                      <Button
                        key={page}
                        variant={page === pagination.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                        disabled={loading}
                      >
                        {page}
                      </Button>
                    ))}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={!pagination.has_next || loading}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}