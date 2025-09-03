import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Search, Users, Pencil, Eye, Download, Calendar as CalendarIcon, UserX, Tag, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import InputMask from "react-input-mask"
import { supabase } from "@/integrations/supabase/client"
import { ClienteDetails } from "@/components/cliente-details"
import { TagModal } from "@/components/clientes/TagModal"
import { TagSelector } from "@/components/clientes/TagSelector"
import { BulkTagActions } from "@/components/clientes/BulkTagActions"
import * as XLSX from "xlsx"

interface Cliente {
  id: string
  cnpj: string
  nome_empresarial: string
  nome_fantasia: string
  ramo_atividade: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cliente_desde: string
  fim_contrato: string | null
  tags?: ClientTag[]
  responsavel?: {
    nome: string
    email: string
  }
}

interface ClientTag {
  id: string
  titulo: string
  cor: string
  descricao: string | null
}

const ramosAtividade = [
  "Comércio",
  "Serviço", 
  "Indústria",
  "Comércio e Serviço",
  "Indústria e Comércio"
]

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ativos")
  const [currentPage, setCurrentPage] = useState(1)
  const [clienteDesdeInput, setClienteDesdeInput] = useState("")
  const [fimContratoInput, setFimContratoInput] = useState("")
  
  // Estados para etiquetas
  const [availableTags, setAvailableTags] = useState<ClientTag[]>([])
  const [selectedTags, setSelectedTags] = useState<ClientTag[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [tagFilterMode, setTagFilterMode] = useState<'AND' | 'OR'>('OR')
  const [tagModalOpen, setTagModalOpen] = useState(false)
  
  const itemsPerPage = 10
  
  const [formData, setFormData] = useState({
    cnpj: "",
    nome_empresarial: "",
    nome_fantasia: "",
    ramo_atividade: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    municipio: "",
    uf: "",
    cliente_desde: undefined as Date | undefined,
    fim_contrato: undefined as Date | undefined
  })
  const [taxFilter, setTaxFilter] = useState<'todos' | 'sem'>('todos')
  const [contatoFilter, setContatoFilter] = useState<'todos' | 'sem'>('todos')
  const [ramoFilter, setRamoFilter] = useState<'todos' | 'nao'>('todos')
  const [taxedClientIds, setTaxedClientIds] = useState<Set<string>>(new Set())
  const [contactedClientIds, setContactedClientIds] = useState<Set<string>>(new Set())
  const [openTaxModal, setOpenTaxModal] = useState(false)
  const [selectedClientForTax, setSelectedClientForTax] = useState<Cliente | null>(null)
  const [taxForm, setTaxForm] = useState({ tipo: '', data: '', valor: '', descricao: '' })
  const [openContactModal, setOpenContactModal] = useState(false)
  const [selectedClientForContact, setSelectedClientForContact] = useState<Cliente | null>(null)
  const [contactForm, setContactForm] = useState({ nome: '', email: '', telefone: '' })
  // Importação em lote
  const [openBatchModal, setOpenBatchModal] = useState(false)
  const [batchInput, setBatchInput] = useState('')
  const [isBatchImporting, setIsBatchImporting] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summary, setSummary] = useState<{ total: number; inserted: number; duplicates: number; invalid: number; failed: number }>({ total: 0, inserted: 0, duplicates: 0, invalid: 0, failed: 0 })
  const { toast } = useToast()

  // Carregar clientes e etiquetas do banco de dados
  const loadClientes = async () => {
    try {
      const [clientsRes, taxationRes, contactsRes, clientTagsRes] = await Promise.all([
        supabase
          .from('clients')
          .select(`
            *,
            client_tag_assignments(
              client_tags(id, titulo, cor, descricao)
            ),
            responsible_assignments!client_id(
              status,
              collaborator:profiles!collaborator_id(nome, email)
            )
          `)
          .order('nome_empresarial'),
        supabase.from('taxation').select('client_id,status').eq('status', 'ativa'),
        supabase.from('contacts').select('client_id'),
        supabase.from('client_tags').select('*').order('titulo')
      ])

      if (clientsRes.error || taxationRes.error || contactsRes.error || clientTagsRes.error) {
        console.error('Erro ao carregar dados:', 
          clientsRes.error || taxationRes.error || contactsRes.error || clientTagsRes.error)
        return
      }

      // Processar clientes com suas etiquetas e responsável
      const clientsWithTags = (clientsRes.data || []).map(client => {
        const activeAssignment = client.responsible_assignments?.find((ra: any) => ra.status === 'vigente')
        return {
          ...client,
          tags: client.client_tag_assignments?.map((assignment: any) => assignment.client_tags) || [],
          responsavel: activeAssignment?.collaborator || null
        }
      })

      setClientes(clientsWithTags)
      setAvailableTags(clientTagsRes.data || [])
      setTaxedClientIds(new Set((taxationRes.data || []).map((t: any) => t.client_id)))
      setContactedClientIds(new Set((contactsRes.data || []).map((c: any) => c.client_id)))
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
    }
  }

  useEffect(() => {
    loadClientes()
  }, [])

  const validateCNPJ = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, "")
    return cleaned.length === 14
  }

  // Função para atualizar etiquetas do cliente
  const updateClientTags = async (clientId: string, tags: ClientTag[]) => {
    try {
      // Remover todas as etiquetas atuais do cliente
      await supabase
        .from('client_tag_assignments')
        .delete()
        .eq('client_id', clientId)

      // Adicionar as novas etiquetas
      if (tags.length > 0) {
        const assignments = tags.map(tag => ({
          client_id: clientId,
          tag_id: tag.id
        }))
        
        const { error } = await supabase
          .from('client_tag_assignments')
          .insert(assignments)
        
        if (error) throw error
      }
    } catch (error) {
      console.error('Erro ao atualizar etiquetas:', error)
      throw error
    }
  }

  // Buscar dados por CNPJ
  const buscarDadosCNPJ = async (cnpj: string) => {
    const cnpjLimpo = cnpj.replace(/\D/g, "")
    if (cnpjLimpo.length !== 14) return

    try {
      const { data, error } = await supabase.functions.invoke('fetch-cnpj', {
        body: { cnpj: cnpjLimpo }
      })
      
      if (error) {
        console.error("Erro ao buscar dados do CNPJ:", error)
        toast({
          title: "Erro",
          description: "Erro ao consultar CNPJ",
          variant: "destructive"
        })
        return
      }
      
      if (data?.status === "OK") {
        setFormData(prev => ({
          ...prev,
          nome_empresarial: data.nome || "",
          nome_fantasia: data.fantasia || "",
          cep: data.cep || "",
          logradouro: data.logradouro || "",
          numero: data.numero || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          municipio: data.municipio || "",
          uf: data.uf || ""
        }))
        
        toast({
          title: "Sucesso",
          description: "Dados do CNPJ preenchidos automaticamente"
        })
      } else {
        toast({
          title: "Erro",
          description: data?.error || "CNPJ não encontrado",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Erro ao buscar dados do CNPJ:", error)
      toast({
        title: "Erro",
        description: "Erro ao consultar CNPJ",
        variant: "destructive"
      })
    }
  }

  // Buscar endereço por CEP
  const buscarEnderecoCEP = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, "")
    if (cepLimpo.length !== 8) return

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await response.json()
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          logradouro: data.logradouro || "",
          bairro: data.bairro || "",
          municipio: data.localidade || "",
          uf: data.uf || ""
        }))
        
        toast({
          title: "Sucesso",
          description: "Endereço preenchido automaticamente"
        })
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error)
    }
  }

  // Filtrar clientes
  const filteredClientes = clientes.filter(cliente => {
    const matchesSearch = cliente.nome_empresarial.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cliente.cnpj.includes(searchTerm) ||
                         (cliente.nome_fantasia && cliente.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const isActive = !cliente.fim_contrato
    const matchesStatus = statusFilter === "todos" || 
                         (statusFilter === "ativos" && isActive) ||
                         (statusFilter === "inativos" && !isActive)

    const matchesTrib = taxFilter === 'todos' || (taxFilter === 'sem' && !taxedClientIds.has(cliente.id))
    const matchesContato = contatoFilter === 'todos' || (contatoFilter === 'sem' && !contactedClientIds.has(cliente.id))
    const matchesRamo = ramoFilter === 'todos' || (ramoFilter === 'nao' && cliente.ramo_atividade === 'Não informado')
    
    // Filtro por etiquetas
    let matchesTags = true
    if (tagFilter.length > 0) {
      const clientTagIds = cliente.tags?.map(tag => tag.id) || []
      if (tagFilterMode === 'AND') {
        // Todas as etiquetas selecionadas devem estar no cliente
        matchesTags = tagFilter.every(tagId => clientTagIds.includes(tagId))
      } else {
        // Pelo menos uma etiqueta selecionada deve estar no cliente
        matchesTags = tagFilter.some(tagId => clientTagIds.includes(tagId))
      }
    }
    
    return matchesSearch && matchesStatus && matchesTrib && matchesContato && matchesRamo && matchesTags
  })

  // Paginação
  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedClientes = filteredClientes.slice(startIndex, startIndex + itemsPerPage)

  // Reset da página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, taxFilter, contatoFilter, ramoFilter, tagFilter])

  const parseDate = (dateString: string) => {
    if (!dateString) return undefined
    try {
      const parsedDate = parse(dateString, "dd/MM/yyyy", new Date())
      return isNaN(parsedDate.getTime()) ? undefined : parsedDate
    } catch {
      return undefined
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.cnpj || !formData.nome_empresarial || !formData.ramo_atividade || !formData.cliente_desde) {
      toast({
        title: "Erro",
        description: "CNPJ, Nome Empresarial, Ramo de Atividade e Cliente desde são obrigatórios",
        variant: "destructive"
      })
      return
    }

    if (!validateCNPJ(formData.cnpj)) {
      toast({
        title: "Erro",
        description: "CNPJ deve ter 14 dígitos",
        variant: "destructive"
      })
      return
    }

    try {
      const clientData = {
        cnpj: formData.cnpj,
        nome_empresarial: formData.nome_empresarial,
        nome_fantasia: formData.nome_fantasia || null,
        ramo_atividade: formData.ramo_atividade,
        cep: formData.cep || null,
        logradouro: formData.logradouro || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        bairro: formData.bairro || null,
        municipio: formData.municipio || null,
        uf: formData.uf || null,
        cliente_desde: formData.cliente_desde!.toISOString().split('T')[0],
        fim_contrato: formData.fim_contrato ? formData.fim_contrato.toISOString().split('T')[0] : null
      }

      if (editingCliente) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', editingCliente.id)
        
        if (error) throw error
        
        // Atualizar etiquetas do cliente
        await updateClientTags(editingCliente.id, selectedTags)
        
        toast({ title: "Sucesso", description: "Cliente atualizado com sucesso" })
      } else {
        const { data: newClient, error } = await supabase
          .from('clients')
          .insert([clientData])
          .select()
          .single()
        
        if (error) throw error
        
        // Adicionar etiquetas ao novo cliente
        if (newClient && selectedTags.length > 0) {
          await updateClientTags(newClient.id, selectedTags)
        }
        
        toast({ title: "Sucesso", description: "Cliente cadastrado com sucesso" })
      }

      await loadClientes()
      resetForm()
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar cliente",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setFormData({
      cnpj: "",
      nome_empresarial: "",
      nome_fantasia: "",
      ramo_atividade: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      municipio: "",
      uf: "",
      cliente_desde: undefined,
      fim_contrato: undefined
    })
    setClienteDesdeInput("")
    setFimContratoInput("")
    setSelectedTags([])
    setEditingCliente(null)
    setIsModalOpen(false)
  }

  const openEditModal = (cliente: Cliente) => {
    setFormData({
      cnpj: cliente.cnpj,
      nome_empresarial: cliente.nome_empresarial,
      nome_fantasia: cliente.nome_fantasia || "",
      ramo_atividade: cliente.ramo_atividade,
      cep: cliente.cep || "",
      logradouro: cliente.logradouro || "",
      numero: cliente.numero || "",
      complemento: cliente.complemento || "",
      bairro: cliente.bairro || "",
      municipio: cliente.municipio || "",
      uf: cliente.uf || "",
      cliente_desde: new Date(cliente.cliente_desde),
      fim_contrato: cliente.fim_contrato ? new Date(cliente.fim_contrato) : undefined
    })
    setClienteDesdeInput(format(new Date(cliente.cliente_desde), "dd/MM/yyyy"))
    setFimContratoInput(cliente.fim_contrato ? format(new Date(cliente.fim_contrato), "dd/MM/yyyy") : "")
    setSelectedTags(cliente.tags || [])
    setEditingCliente(cliente)
    setIsModalOpen(true)
  }

  const openViewModal = (cliente: Cliente) => {
    setViewingCliente(cliente)
  }

  const desativarCliente = async (clienteId: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ fim_contrato: new Date().toISOString().split('T')[0] })
        .eq('id', clienteId)
      
      if (error) throw error
      
      await loadClientes()
      toast({ 
        title: "Sucesso", 
        description: "Cliente desativado com sucesso" 
      })
    } catch (error: any) {
      console.error('Erro ao desativar cliente:', error)
      toast({
        title: "Erro",
        description: "Erro ao desativar cliente",
        variant: "destructive"
      })
    }
  }

  const excluirCliente = async (clienteId: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clienteId)
      
      if (error) throw error
      
      await loadClientes()
      toast({ 
        title: "Sucesso", 
        description: "Cliente excluído com sucesso" 
      })
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error)
      toast({
        title: "Erro",
        description: "Erro ao excluir cliente",
        variant: "destructive"
      })
    }
  }

  const handleCreateTaxation = async () => {
    if (!selectedClientForTax) return
    if (!taxForm.tipo || !taxForm.data) {
      toast({ title: 'Preencha tipo e data', variant: 'destructive' })
      return
    }
    try {
      const { error } = await supabase.from('taxation').insert({
        client_id: selectedClientForTax.id,
        tipo: taxForm.tipo,
        data: taxForm.data,
        status: 'ativa',
        valor: taxForm.valor ? Number(taxForm.valor) : null,
        descricao: taxForm.descricao || null,
      })
      if (error) throw error
      toast({ title: 'Tributação criada com sucesso' })
      setOpenTaxModal(false)
      setTaxForm({ tipo: '', data: '', valor: '', descricao: '' })
      setSelectedClientForTax(null)
      loadClientes()
    } catch (err: any) {
      toast({ title: 'Erro ao criar tributação', description: err.message, variant: 'destructive' })
    }
  }

  const handleCreateContact = async () => {
    if (!selectedClientForContact) return
    if (!contactForm.nome || !contactForm.email || !contactForm.telefone) {
      toast({ title: 'Preencha nome, e-mail e telefone', variant: 'destructive' })
      return
    }
    try {
      const { error } = await supabase.from('contacts').insert({
        client_id: selectedClientForContact.id,
        nome: contactForm.nome,
        email: contactForm.email,
        telefone: contactForm.telefone,
      })
      if (error) throw error
      toast({ title: 'Contato criado com sucesso' })
      setOpenContactModal(false)
      setContactForm({ nome: '', email: '', telefone: '' })
      setSelectedClientForContact(null)
      loadClientes()
    } catch (err: any) {
      toast({ title: 'Erro ao criar contato', description: err.message, variant: 'destructive' })
    }
  }

  const handleExportXLSX = () => {
    try {
      const rows = clientes.map((c) => ({
        'CNPJ': c.cnpj,
        'Nome Empresarial': c.nome_empresarial,
        'Nome Fantasia': c.nome_fantasia || '',
        'Ramo de Atividade': c.ramo_atividade,
        'CEP': c.cep || '',
        'Logradouro': c.logradouro || '',
        'Numero': c.numero || '',
        'Complemento': c.complemento || '',
        'Bairro': c.bairro || '',
        'Municipio': c.municipio || '',
        'UF': c.uf || '',
        'Cliente Desde': c.cliente_desde || '',
        'Fim Contrato': c.fim_contrato || '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
      XLSX.writeFile(wb, 'clientes.xlsx')
      toast({ title: 'Arquivo gerado', description: `Exportamos ${rows.length} cliente(s).` })
    } catch (err: any) {
      console.error('Erro ao gerar XLSX:', err)
      toast({ title: 'Erro ao gerar XLSX', description: err.message || 'Falha ao gerar arquivo.', variant: 'destructive' })
    }
  }
  // Helpers para importação em lote
  const formatCnpj = (value: string) => {
    const v = value.replace(/\D/g, "")
    if (v.length !== 14) return value
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
  }

  const parseBatchCnpjs = (raw: string) => {
    const items = raw.split(',').map((s) => s.trim()).filter(Boolean)
    const seen = new Set<string>()
    const list: string[] = []
    let invalid = 0
    for (const it of items) {
      const digits = it.replace(/\D/g, '')
      if (digits.length === 14) {
        if (!seen.has(digits)) {
          seen.add(digits)
          list.push(digits)
        }
      } else if (digits.length > 0) {
        invalid++
      }
    }
    return { list, invalid }
  }

  const handleBatchImport = async () => {
    setIsBatchImporting(true)
    try {
      const { list, invalid } = parseBatchCnpjs(batchInput)
      // mapa de CNPJs já existentes (normalizados)
      const existing = new Set<string>(clientes.map((c) => (c.cnpj || '').replace(/\D/g, '')))

      let duplicates = 0
      let failed = 0
      const toInsert: any[] = []

      for (const cnpj of list) {
        if (existing.has(cnpj)) {
          duplicates++
          continue
        }
        // Buscar dados via Edge Function
        const { data, error } = await supabase.functions.invoke('fetch-cnpj', { body: { cnpj } })
        if (error || !data || data.status !== 'OK') {
          failed++
          continue
        }
        const orNull = (v?: string) => (v && String(v).trim() !== '' ? v : null)
        toInsert.push({
          cnpj: formatCnpj(cnpj),
          nome_empresarial: data.nome || '',
          nome_fantasia: orNull(data.fantasia || undefined),
          ramo_atividade: 'Não informado',
          cep: orNull(data.cep || undefined),
          logradouro: orNull(data.logradouro || undefined),
          numero: orNull(data.numero || undefined),
          complemento: orNull(data.complemento || undefined),
          bairro: orNull(data.bairro || undefined),
          municipio: orNull(data.municipio || undefined),
          uf: orNull(data.uf || undefined),
        })
      }

      let inserted = 0
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('clients').insert(toInsert)
        if (insertError) {
          // Se falhar a inserção em lote, considera todos como falha
          failed += toInsert.length
        } else {
          inserted = toInsert.length
        }
      }

      setSummary({ total: list.length, inserted, duplicates, invalid, failed })
      setSummaryOpen(true)
      setOpenBatchModal(false)
      setBatchInput('')
      await loadClientes()
      toast({ title: 'Importação concluída', description: `${inserted} cadastrado(s), ${duplicates} duplicado(s), ${invalid} inválido(s), ${failed} com erro.` })
    } catch (e) {
      console.error(e)
      toast({ title: 'Erro', description: 'Falha na importação em lote.', variant: 'destructive' })
    } finally {
      setIsBatchImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os clientes do escritório
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTagModalOpen(true)}>
            <Tag className="mr-2 h-4 w-4" />
            Gerenciar Etiquetas
          </Button>
          
          <BulkTagActions 
            clients={filteredClientes.map(c => ({ id: c.id, nome_empresarial: c.nome_empresarial, cnpj: c.cnpj }))}
            availableTags={availableTags}
            onComplete={loadClientes}
          />
          
          <Button variant="outline" onClick={handleExportXLSX}>
            <Download className="mr-2 h-4 w-4" />
            Gerar XLSX
          </Button>
          <Button className="bg-gradient-primary hover:opacity-90" onClick={() => setOpenBatchModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Clientes em lote
          </Button>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90" onClick={() => setEditingCliente(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                     <InputMask
                       mask="99.999.999/9999-99"
                       value={formData.cnpj}
                       onChange={(e) => {
                         setFormData(prev => ({...prev, cnpj: e.target.value}))
                         if (e.target.value.replace(/\D/g, "").length === 14) {
                           buscarDadosCNPJ(e.target.value)
                         }
                       }}
                     >
                       {() => <Input placeholder="00.000.000/0000-00" />}
                     </InputMask>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ramo_atividade">Ramo de Atividade *</Label>
                    <Select 
                      value={formData.ramo_atividade} 
                      onValueChange={(value) => setFormData(prev => ({...prev, ramo_atividade: value}))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o ramo" />
                      </SelectTrigger>
                      <SelectContent>
                        {ramosAtividade.map(ramo => (
                          <SelectItem key={ramo} value={ramo}>
                            {ramo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="nome_empresarial">Nome Empresarial *</Label>
                    <Input
                      id="nome_empresarial"
                      value={formData.nome_empresarial}
                      onChange={(e) => setFormData(prev => ({...prev, nome_empresarial: e.target.value}))}
                      placeholder="Nome empresarial"
                    />
                  </div>

                   <div className="col-span-2 space-y-2">
                     <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                     <Input
                       id="nome_fantasia"
                       value={formData.nome_fantasia}
                       onChange={(e) => setFormData(prev => ({...prev, nome_fantasia: e.target.value}))}
                       placeholder="Nome fantasia"
                     />
                   </div>

                   {/* Campo para etiquetas */}
                   <div className="col-span-2 space-y-2">
                     <Label>Etiquetas</Label>
                     <TagSelector
                       selectedTags={selectedTags}
                       onTagsChange={setSelectedTags}
                       placeholder="Selecionar etiquetas para o cliente"
                     />
                   </div>

                   <div className="space-y-2">
                     <Label htmlFor="cep">CEP</Label>
                     <InputMask
                       mask="99999-999"
                       value={formData.cep}
                       onChange={(e) => {
                         setFormData(prev => ({...prev, cep: e.target.value}))
                         if (e.target.value.replace(/\D/g, "").length === 8) {
                           buscarEnderecoCEP(e.target.value)
                         }
                       }}
                     >
                       {() => <Input placeholder="00000-000" />}
                     </InputMask>
                   </div>

                  <div className="space-y-2">
                    <Label htmlFor="logradouro">Logradouro</Label>
                    <Input
                      id="logradouro"
                      value={formData.logradouro}
                      onChange={(e) => setFormData(prev => ({...prev, logradouro: e.target.value}))}
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      value={formData.numero}
                      onChange={(e) => setFormData(prev => ({...prev, numero: e.target.value}))}
                      placeholder="123"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input
                      id="complemento"
                      value={formData.complemento}
                      onChange={(e) => setFormData(prev => ({...prev, complemento: e.target.value}))}
                      placeholder="Sala, Andar, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={formData.bairro}
                      onChange={(e) => setFormData(prev => ({...prev, bairro: e.target.value}))}
                      placeholder="Nome do bairro"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="municipio">Município</Label>
                    <Input
                      id="municipio"
                      value={formData.municipio}
                      onChange={(e) => setFormData(prev => ({...prev, municipio: e.target.value}))}
                      placeholder="Nome da cidade"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="uf">UF</Label>
                    <Select 
                      value={formData.uf} 
                      onValueChange={(value) => setFormData(prev => ({...prev, uf: value}))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {estadosBrasil.map(estado => (
                          <SelectItem key={estado} value={estado}>
                            {estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                   <div className="space-y-2">
                     <Label>Cliente desde *</Label>
                     <div className="flex gap-2">
                        <InputMask
                          mask="99/99/9999"
                          value={clienteDesdeInput}
                          onChange={(e) => {
                            const value = e.target.value
                            setClienteDesdeInput(value)
                            
                            if (value.length === 10) {
                              const parsed = parseDate(value)
                              if (parsed) {
                                setFormData(prev => ({...prev, cliente_desde: parsed}))
                              }
                            } else if (value.length < 10) {
                              setFormData(prev => ({...prev, cliente_desde: undefined}))
                            }
                          }}
                        >
                         {() => <Input placeholder="dd/mm/aaaa" className="flex-1" />}
                       </InputMask>
                       <Popover>
                         <PopoverTrigger asChild>
                           <Button variant="outline" size="sm">
                             <CalendarIcon className="h-4 w-4" />
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0" align="start">
                           <Calendar
                             mode="single"
                             selected={formData.cliente_desde}
                             onSelect={(date) => {
                               setFormData(prev => ({...prev, cliente_desde: date}))
                               setClienteDesdeInput(date ? format(date, "dd/MM/yyyy") : "")
                             }}
                             initialFocus
                             className="pointer-events-auto"
                           />
                         </PopoverContent>
                       </Popover>
                     </div>
                   </div>

                   <div className="space-y-2">
                     <Label>Fim do contrato</Label>
                     <div className="flex gap-2">
                       <InputMask
                         mask="99/99/9999"
                         value={fimContratoInput}
                         onChange={(e) => {
                           setFimContratoInput(e.target.value)
                           const parsed = parseDate(e.target.value)
                           setFormData(prev => ({...prev, fim_contrato: parsed}))
                         }}
                       >
                         {() => <Input placeholder="dd/mm/aaaa" className="flex-1" />}
                       </InputMask>
                       <Popover>
                         <PopoverTrigger asChild>
                           <Button variant="outline" size="sm">
                             <CalendarIcon className="h-4 w-4" />
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0" align="start">
                           <Calendar
                             mode="single"
                             selected={formData.fim_contrato}
                             onSelect={(date) => {
                               setFormData(prev => ({...prev, fim_contrato: date}))
                               setFimContratoInput(date ? format(date, "dd/MM/yyyy") : "")
                             }}
                             initialFocus
                             className="pointer-events-auto"
                           />
                         </PopoverContent>
                       </Popover>
                     </div>
                   </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-primary hover:opacity-90">
                    {editingCliente ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Use os filtros para encontrar clientes específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filtros rápidos por etiqueta */}
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtrar por etiquetas
                  </Label>
                  <Select value={tagFilterMode} onValueChange={(v: 'AND' | 'OR') => setTagFilterMode(v)}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OR">OU</SelectItem>
                      <SelectItem value="AND">E</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = tagFilter.includes(tag.id)
                    return (
                      <Badge
                        key={tag.id}
                        variant={isSelected ? "default" : "outline"}
                        style={isSelected ? { backgroundColor: tag.cor, color: '#fff' } : { borderColor: tag.cor, color: tag.cor }}
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => {
                          if (isSelected) {
                            setTagFilter(prev => prev.filter(id => id !== tag.id))
                          } else {
                            setTagFilter(prev => [...prev, tag.id])
                          }
                        }}
                      >
                        {tag.titulo}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
            
            <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nome ou CNPJ..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={taxFilter} onValueChange={(v: any) => setTaxFilter(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Tributação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Tributação: Todos</SelectItem>
                <SelectItem value="sem">Sem tributação definida</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contatoFilter} onValueChange={(v: any) => setContatoFilter(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Contato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Contato: Todos</SelectItem>
                <SelectItem value="sem">Sem contato cadastrado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ramoFilter} onValueChange={(v: any) => setRamoFilter(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Ramo de atividade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Ramo: Todos</SelectItem>
                <SelectItem value="nao">Ramo: Não informado</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            {filteredClientes.length} cliente(s) encontrado(s) • Página {currentPage} de {totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paginatedClientes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum cliente encontrado</p>
              <p className="text-sm">
                {searchTerm || statusFilter !== "ativos" 
                  ? "Tente ajustar os filtros de busca" 
                  : "Clique em \"Novo Cliente\" para adicionar"
                }
              </p>
            </div>
          ) : (
            <>
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Cliente</TableHead>
                     <TableHead>CNPJ / Ramo</TableHead>
                     <TableHead>Responsável</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Etiquetas</TableHead>
                     <TableHead className="text-right">Ações</TableHead>
                   </TableRow>
                 </TableHeader>
                <TableBody>
                  {paginatedClientes.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{cliente.nome_empresarial}</p>
                          {cliente.nome_fantasia && (
                            <p className="text-sm text-muted-foreground">{cliente.nome_fantasia}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Cliente desde: {format(new Date(cliente.cliente_desde), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                         <div>
                           <p className="text-sm">{cliente.cnpj}</p>
                           <p className="text-xs text-muted-foreground">{cliente.ramo_atividade}</p>
                         </div>
                       </TableCell>
                       
                       <TableCell>
                         {cliente.responsavel ? (
                           <div>
                             <p className="text-sm font-medium">{cliente.responsavel.nome}</p>
                             <p className="text-xs text-muted-foreground">{cliente.responsavel.email}</p>
                           </div>
                         ) : (
                           <span className="text-xs text-muted-foreground">Não atribuído</span>
                         )}
                       </TableCell>
                      
                      <TableCell>
                        {cliente.fim_contrato ? (
                          <Badge variant="destructive" className="text-xs">
                            Inativo
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-xs">
                            Ativo
                          </Badge>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {cliente.tags && cliente.tags.length > 0 ? (
                            cliente.tags.map((tag) => (
                              <Badge
                                key={tag.id}
                                style={{ backgroundColor: tag.cor, color: "#fff" }}
                                className="text-xs"
                              >
                                {tag.titulo}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewModal(cliente)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(cliente)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {taxFilter === "sem" && !cliente.fim_contrato && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClientForTax(cliente)
                                setOpenTaxModal(true)
                              }}
                              className="text-xs"
                            >
                              Nova Tributação
                            </Button>
                          )}
                          {contatoFilter === "sem" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClientForContact(cliente)
                                setOpenContactModal(true)
                              }}
                              className="text-xs"
                            >
                              Novo Contato
                            </Button>
                          )}
                          {ramoFilter === "nao" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(cliente)}
                              className="text-xs"
                            >
                              Informar atividade
                            </Button>
                          )}
                          {!cliente.fim_contrato && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => desativarCliente(cliente.id)}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => excluirCliente(cliente.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            🗑️
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Visualização */}
      <Dialog open={!!viewingCliente} onOpenChange={() => setViewingCliente(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          
          {viewingCliente && (
            <>
              <ClienteDetails cliente={viewingCliente} />
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setViewingCliente(null)}>
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Nova Tributação */}
      <Dialog open={openTaxModal} onOpenChange={setOpenTaxModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tributação</DialogTitle>
            <DialogDescription>
              Cliente: {selectedClientForTax?.nome_empresarial}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={taxForm.tipo} onValueChange={(v) => setTaxForm((f) => ({ ...f, tipo: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                  <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="Lucro Real Anual">Lucro Real Anual</SelectItem>
                  <SelectItem value="Lucro Real Trimestral">Lucro Real Trimestral</SelectItem>
                  <SelectItem value="Isento/Imune">Isento/Imune</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={taxForm.data}
                onChange={(e) => setTaxForm((f) => ({ ...f, data: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={taxForm.valor}
                onChange={(e) => setTaxForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={taxForm.descricao}
                onChange={(e) => setTaxForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTaxModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTaxation} disabled={!taxForm.tipo || !taxForm.data}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Novo Contato */}
      <Dialog open={openContactModal} onOpenChange={setOpenContactModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Contato</DialogTitle>
            <DialogDescription>
              Cliente: {selectedClientForContact?.nome_empresarial}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={contactForm.nome}
                onChange={(e) => setContactForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={contactForm.telefone}
                onChange={(e) => setContactForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenContactModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateContact} disabled={!contactForm.nome || !contactForm.email || !contactForm.telefone}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Importar Clientes em Lote */}
      <Dialog open={openBatchModal} onOpenChange={setOpenBatchModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Importar clientes em lote</DialogTitle>
            <DialogDescription>
              Cole os CNPJ separados por vírgula. Exemplo: 17.496.049/0001-80, 40987910000124, 06.085.938/0001-38, 03379896000150
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>CNPJs</Label>
            <Textarea
              placeholder="17.496.049/0001-80, 40987910000124, 06.085.938/0001-38, 03379896000150"
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">Separe por vírgula. Aceita com ou sem pontuação.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBatchModal(false)} disabled={isBatchImporting}>
              Cancelar
            </Button>
            <Button onClick={handleBatchImport} disabled={!batchInput.trim() || isBatchImporting}>
              {isBatchImporting ? 'Importando...' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Resumo da Importação */}
       <AlertDialog open={summaryOpen} onOpenChange={setSummaryOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Importação concluída</AlertDialogTitle>
             <AlertDialogDescription>
               {summary.inserted} cadastrado(s), {summary.duplicates} duplicado(s), {summary.invalid} inválido(s), {summary.failed} com erro.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogAction onClick={() => setSummaryOpen(false)}>OK</AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>

       {/* Modal de Gerenciamento de Etiquetas */}
       <TagModal 
         open={tagModalOpen} 
         onOpenChange={setTagModalOpen}
       />
     </div>
   )
 }