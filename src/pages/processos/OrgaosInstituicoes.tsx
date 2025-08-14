import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Eye, Edit, Trash2, FileText, Download, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgaoInstituicao {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  link_dinamico?: string;
  created_at: string;
  updated_at: string;
}

interface OrgaoComDocumentos extends OrgaoInstituicao {
  documentos: DocumentoModelo[];
}

interface DocumentoModelo {
  id: string;
  orgao_id: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho: number;
  url: string;
  created_at: string;
}

export function OrgaosInstituicoes() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingOrgao, setEditingOrgao] = useState<OrgaoInstituicao | null>(null);
  const [viewingOrgao, setViewingOrgao] = useState<OrgaoInstituicao | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    link_dinamico: ""
  });

  const isAdmin = profile?.role === 'administrador';

  useEffect(() => {
    document.title = "Órgãos/Instituições | GConTE";
  }, []);

  // Buscar órgãos/instituições com contagem de documentos
  const { data: orgaos = [], isLoading } = useQuery({
    queryKey: ["orgaos-instituicoes"],
    queryFn: async () => {
      // Buscar órgãos
      const { data: orgaosData, error: orgaosError } = await supabase
        .from("orgaos_instituicoes")
        .select("*")
        .order("nome");
      
      if (orgaosError) throw orgaosError;

      // Buscar contagem de documentos para cada órgão
      const orgaosWithDocs = await Promise.all(
        (orgaosData || []).map(async (orgao) => {
          const { data: docsData, error: docsError } = await supabase
            .from("orgao_documentos_modelo")
            .select("*")
            .eq("orgao_id", orgao.id);
          
          if (docsError) {
            console.error("Erro ao buscar documentos:", docsError);
            return { ...orgao, documentos: [] };
          }
          
          return { ...orgao, documentos: docsData || [] };
        })
      );
      
      return orgaosWithDocs as OrgaoComDocumentos[];
    }
  });

  // Buscar documentos modelo de um órgão específico
  const { data: documentos = [] } = useQuery({
    queryKey: ["documentos-modelo", viewingOrgao?.id],
    queryFn: async () => {
      if (!viewingOrgao?.id) return [];
      
      const { data, error } = await supabase
        .from("orgao_documentos_modelo")
        .select("*")
        .eq("orgao_id", viewingOrgao.id)
        .order("nome_arquivo");
      
      if (error) throw error;
      return data as DocumentoModelo[];
    },
    enabled: !!viewingOrgao?.id
  });

  // Mutation para criar/atualizar órgão
  const saveOrgaoMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Esta função não será mais usada diretamente, o handleSubmit faz tudo
      return data;
    },
    onSuccess: () => {
      // Callback vazio - o handleSubmit gerencia tudo
    },
    onError: () => {
      // Callback vazio - o handleSubmit gerencia tudo
    }
  });

  // Mutation para deletar órgão
  const deleteOrgaoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("orgaos_instituicoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgaos-instituicoes"] });
      toast({
        title: "Sucesso",
        description: "Órgão/Instituição excluído com sucesso"
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir órgão/instituição",
        variant: "destructive"
      });
    }
  });

  // Upload de documentos
  const uploadDocumentosMutation = useMutation({
    mutationFn: async ({ orgaoId, files }: { orgaoId: string; files: File[] }) => {
      const uploadPromises = files.map(async (file) => {
        const fileName = `${orgaoId}/${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("orgao-documentos")
          .upload(fileName, file);
          
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("orgao-documentos")
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from("orgao_documentos_modelo")
          .insert([{
            orgao_id: orgaoId,
            nome_arquivo: file.name,
            mime_type: file.type,
            tamanho: file.size,
            url: fileName
          }]);
          
        if (dbError) throw dbError;
      });

      await Promise.all(uploadPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-modelo"] });
      toast({
        title: "Sucesso",
        description: "Documentos enviados com sucesso"
      });
      setUploadingFiles([]);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao enviar documentos",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({ nome: "", telefone: "", email: "", link_dinamico: "" });
    setEditingOrgao(null);
    setDialogOpen(false);
    setUploadingFiles([]);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (orgao: OrgaoInstituicao) => {
    setFormData({
      nome: orgao.nome,
      telefone: orgao.telefone || "",
      email: orgao.email || "",
      link_dinamico: orgao.link_dinamico || ""
    });
    setEditingOrgao(orgao);
    setUploadingFiles([]);
    setDialogOpen(true);
  };

  const openViewDialog = (orgao: OrgaoInstituicao) => {
    setViewingOrgao(orgao);
    setViewDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim() || formData.nome.length < 2 || formData.nome.length > 120) {
      toast({
        title: "Erro",
        description: "Nome deve ter entre 2 e 120 caracteres",
        variant: "destructive"
      });
      return;
    }

    try {
      // Converter strings vazias para null para campos opcionais
      const submissionData = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim() || null,
        email: formData.email.trim() || null,
        link_dinamico: formData.link_dinamico.trim() || null
      };

      // Salvar o órgão primeiro
      let orgaoId: string;
      
      if (editingOrgao) {
        const { error } = await supabase
          .from("orgaos_instituicoes")
          .update(submissionData)
          .eq("id", editingOrgao.id);
        if (error) throw error;
        orgaoId = editingOrgao.id;
      } else {
        const { data, error } = await supabase
          .from("orgaos_instituicoes")
          .insert([submissionData])
          .select()
          .single();
        if (error) throw error;
        orgaoId = data.id;
      }

      // Fazer upload dos arquivos se houver
      if (uploadingFiles.length > 0) {
        await uploadDocumentosMutation.mutateAsync({ orgaoId, files: uploadingFiles });
      }

      queryClient.invalidateQueries({ queryKey: ["orgaos-instituicoes"] });
      toast({
        title: "Sucesso",
        description: `Órgão/Instituição ${editingOrgao ? 'atualizado' : 'criado'} com sucesso`
      });
      resetForm();
      
    } catch (error: any) {
      const isUnique = error?.message?.includes('duplicate key value violates unique constraint');
      toast({
        title: "Erro",
        description: isUnique 
          ? "Já existe um órgão/instituição com este nome" 
          : "Erro ao salvar órgão/instituição",
        variant: "destructive"
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg'
      ];
      const validSize = file.size <= 10485760; // 10MB
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Arquivo inválido",
          description: `${file.name}: Tipo de arquivo não suportado`,
          variant: "destructive"
        });
        return false;
      }
      
      if (!validSize) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name}: Arquivo deve ter no máximo 10MB`,
          variant: "destructive"
        });
        return false;
      }
      
      return true;
    });
    
    setUploadingFiles(prev => [...prev, ...validFiles]);
  };

  const removeUploadingFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadDocuments = () => {
    if (!viewingOrgao || uploadingFiles.length === 0) return;
    uploadDocumentosMutation.mutate({ orgaoId: viewingOrgao.id, files: uploadingFiles });
  };

  const downloadDocument = async (documento: DocumentoModelo) => {
    try {
      const { data, error } = await supabase.storage
        .from("orgao-documentos")
        .download(documento.url);
        
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = documento.nome_arquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao baixar documento",
        variant: "destructive"
      });
    }
  };

  const downloadDocumentFromList = async (documento: DocumentoModelo) => {
    try {
      const { data, error } = await supabase.storage
        .from("orgao-documentos")
        .download(documento.url);
        
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = documento.nome_arquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao baixar documento",
        variant: "destructive"
      });
    }
  };

  const downloadAllDocuments = async () => {
    if (!documentos.length) return;
    
    for (const doc of documentos) {
      await downloadDocument(doc);
      // Pequeno delay entre downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const filteredOrgaos = orgaos.filter(orgao =>
    orgao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (orgao.email && orgao.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatTelefone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    
    if (cleaned.length <= 10) {
      // Formato: (XX) XXXX-XXXX
      const match = cleaned.match(/^(\d{2})(\d{4})(\d{4})$/);
      if (match && cleaned.length === 10) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
      }
    } else {
      // Formato: (XX) XXXXX-XXXX
      const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
      if (match && cleaned.length === 11) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
      }
    }
    
    // Formato parcial enquanto digita
    if (cleaned.length >= 2) {
      let formatted = `(${cleaned.substring(0, 2)})`;
      if (cleaned.length > 2) {
        formatted += ` ${cleaned.substring(2, cleaned.length <= 6 ? cleaned.length : cleaned.length <= 10 ? 6 : 7)}`;
        if (cleaned.length > (cleaned.length <= 10 ? 6 : 7)) {
          formatted += `-${cleaned.substring(cleaned.length <= 10 ? 6 : 7, cleaned.length <= 10 ? 10 : 11)}`;
        }
      }
      return formatted;
    }
    
    return value;
  };

  return (
    <div className="max-w-[1920px] w-full mx-auto" style={{ paddingInline: 'var(--nobleui-gap)' }}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Órgãos/Instituições</h1>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Órgão/Instituição
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingOrgao ? 'Editar' : 'Novo'} Órgão/Instituição
                  </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome do órgão/instituição"
                      maxLength={120}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        telefone: formatTelefone(e.target.value) 
                      }))}
                      placeholder="(XX) XXXXX-XXXX"
                      maxLength={15}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="link_dinamico">Link Dinâmico</Label>
                    <Input
                      id="link_dinamico"
                      type="url"
                      value={formData.link_dinamico}
                      onChange={(e) => setFormData(prev => ({ ...prev, link_dinamico: e.target.value }))}
                      placeholder="https://exemplo.com"
                    />
                  </div>

                  {/* Upload de documentos */}
                  {isAdmin && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label>Documentos Modelo</Label>
                        <div className="inline-flex">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                            className="hidden"
                            id="file-upload-form"
                          />
                          <Label htmlFor="file-upload-form" className="cursor-pointer">
                            <Button type="button" size="sm" variant="outline" asChild>
                              <span>
                                <Upload className="h-4 w-4 mr-2" />
                                Selecionar Arquivos
                              </span>
                            </Button>
                          </Label>
                        </div>
                      </div>

                      {/* Arquivos selecionados */}
                      {uploadingFiles.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Arquivos selecionados:</Label>
                          {uploadingFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                              <span className="text-sm">{file.name}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeUploadingFile(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saveOrgaoMutation.isPending || uploadDocumentosMutation.isPending}>
                      {(saveOrgaoMutation.isPending || uploadDocumentosMutation.isPending) ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Lista de Órgãos/Instituições</CardTitle>
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Documentos</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgaos.map((orgao) => (
                    <TableRow key={orgao.id}>
                      <TableCell className="font-medium">{orgao.nome}</TableCell>
                      <TableCell>{orgao.telefone || "-"}</TableCell>
                      <TableCell>{orgao.email || "-"}</TableCell>
                      <TableCell>
                        {orgao.documentos && orgao.documentos.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="cursor-pointer">
                              <FileText className="h-3 w-3 mr-1" />
                              {orgao.documentos.length} documento{orgao.documentos.length > 1 ? 's' : ''}
                            </Badge>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const promises = orgao.documentos.map(doc => downloadDocumentFromList(doc));
                                      Promise.all(promises);
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Baixar todos os documentos</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ) : (
                          <Badge variant="outline">
                            Sem documentos
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openViewDialog(orgao)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Visualizar detalhes</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          {isAdmin && (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditDialog(orgao)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Editar</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              <AlertDialog>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="ghost">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Excluir</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir "{orgao.nome}"? 
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteOrgaoMutation.mutate(orgao.id)}
                                      className="bg-destructive text-destructive-foreground"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredOrgaos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        Nenhum órgão/instituição encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog de visualização */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {viewingOrgao?.nome}
              </DialogTitle>
            </DialogHeader>
            
            {viewingOrgao && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Telefone</Label>
                    <p className="text-sm">{viewingOrgao.telefone || "-"}</p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p className="text-sm">{viewingOrgao.email || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label>Link Dinâmico</Label>
                    <p className="text-sm">
                      {viewingOrgao.link_dinamico ? (
                        <a 
                          href={viewingOrgao.link_dinamico} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {viewingOrgao.link_dinamico}
                        </a>
                      ) : "-"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Documentos Modelo</h3>
                    <div className="space-x-2">
                      {documentos.length > 0 && (
                        <Button size="sm" variant="outline" onClick={downloadAllDocuments}>
                          <Download className="h-4 w-4 mr-2" />
                          Baixar Todos
                        </Button>
                      )}
                      {isAdmin && (
                        <div className="inline-flex">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                            className="hidden"
                            id="file-upload"
                          />
                          <Label htmlFor="file-upload" className="cursor-pointer">
                            <Button size="sm" asChild>
                              <span>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload
                              </span>
                            </Button>
                          </Label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Arquivos sendo enviados */}
                  {uploadingFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Arquivos para envio:</h4>
                      {uploadingFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                          <span className="text-sm">{file.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeUploadingFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        onClick={handleUploadDocuments}
                        disabled={uploadDocumentosMutation.isPending}
                      >
                        {uploadDocumentosMutation.isPending ? "Enviando..." : "Confirmar Upload"}
                      </Button>
                    </div>
                  )}

                  {/* Lista de documentos */}
                  <div className="space-y-2">
                    {documentos.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded"
                      >
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{doc.nome_arquivo}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(doc.tamanho / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadDocument(doc)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {documentos.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum documento modelo cadastrado
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}