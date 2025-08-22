import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Search, Calendar as CalendarIcon, Pencil, Eye, Trash2, Check, ChevronsUpDown } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { format, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import ReactQuill from "react-quill"
import "react-quill/dist/quill.snow.css"
import { supabase } from "@/integrations/supabase/client"

interface Evento {
  id: string
  client_id: string
  clienteNome: string
  data: Date
  setor: string
  titulo: string
  descricao: string
}

interface Cliente {
  id: string
  nome_empresarial: string
  nome_fantasia?: string
}

const setores = [
  "Contábil",
  "Fiscal", 
  "Pessoal",
  "Societário",
  "Financeiro",
  "Outro"
]

export function Eventos() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null)
  const [viewingEvento, setViewingEvento] = useState<Evento | null>(null)
  const [deletingEvento, setDeletingEvento] = useState<Evento | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    clienteId: "",
    data: undefined as Date | undefined,
    setor: "",
    titulo: "",
    descricao: ""
  })
  const [openClienteCombobox, setOpenClienteCombobox] = useState(false)
  const [dateInput, setDateInput] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadClientes()
    loadEventos()
  }, [])

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nome_empresarial, nome_fantasia')
        .order('nome_empresarial')

      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de clientes",
        variant: "destructive"
      })
    }
  }

  const loadEventos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          clients!inner(nome_empresarial)
        `)
        .order('data', { ascending: false })

      if (error) throw error

      const eventosFormatted = (data || []).map(item => ({
        id: item.id,
        client_id: item.client_id,
        clienteNome: item.clients.nome_empresarial,
        data: new Date(item.data),
        setor: item.setor,
        titulo: item.titulo,
        descricao: item.descricao
      }))

      setEventos(eventosFormatted)
    } catch (error) {
      console.error('Erro ao carregar eventos:', error)
      toast({
        title: "Erro", 
        description: "Erro ao carregar eventos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.clienteId || !formData.data || !formData.setor || !formData.titulo || !formData.descricao) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      })
      return
    }

    try {
      if (editingEvento) {
        const { error } = await supabase
          .from('events')
          .update({
            client_id: formData.clienteId,
            data: formData.data.toISOString().split('T')[0],
            setor: formData.setor,
            titulo: formData.titulo,
            descricao: formData.descricao
          })
          .eq('id', editingEvento.id)

        if (error) throw error
        toast({ title: "Sucesso", description: "Evento atualizado com sucesso" })
      } else {
        const { error } = await supabase
          .from('events')
          .insert({
            client_id: formData.clienteId,
            data: formData.data.toISOString().split('T')[0],
            setor: formData.setor,
            titulo: formData.titulo,
            descricao: formData.descricao
          })

        if (error) throw error
        toast({ title: "Sucesso", description: "Evento cadastrado com sucesso" })
      }

      await loadEventos()
      resetForm()
    } catch (error) {
      console.error('Erro ao salvar evento:', error)
      toast({
        title: "Erro",
        description: "Erro ao salvar evento",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setFormData({ clienteId: "", data: undefined, setor: "", titulo: "", descricao: "" })
    setDateInput("")
    setEditingEvento(null)
    setOpenClienteCombobox(false)
    setIsModalOpen(false)
  }

  const openEditModal = (evento: Evento) => {
    setFormData({
      clienteId: evento.client_id,
      data: evento.data,
      setor: evento.setor,
      titulo: evento.titulo,
      descricao: evento.descricao
    })
    setDateInput(format(evento.data, "dd/MM/yyyy"))
    setEditingEvento(evento)
    setIsModalOpen(true)
  }

  const openViewModal = (evento: Evento) => {
    setViewingEvento(evento)
  }

  const handleDelete = async () => {
    if (!deletingEvento) return

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', deletingEvento.id)

      if (error) throw error

      await loadEventos()
      setDeletingEvento(null)
      toast({ title: "Sucesso", description: "Evento excluído com sucesso" })
    } catch (error) {
      console.error('Erro ao excluir evento:', error)
      toast({
        title: "Erro",
        description: "Erro ao excluir evento",
        variant: "destructive"
      })
    }
  }

  const handleDateInputChange = (value: string) => {
    setDateInput(value)
    
    // Tentar fazer parse da data digitada (formato brasileiro: dd/mm/aaaa)
    if (value.length === 10) {
      try {
        const parsedDate = parse(value, "dd/MM/yyyy", new Date())
        if (!isNaN(parsedDate.getTime())) {
          setFormData(prev => ({...prev, data: parsedDate}))
        }
      } catch (error) {
        // Ignorar erros de parse
      }
    }
  }

  const eventosFiltrados = useMemo(() => {
    if (!searchTerm) return eventos
    
    return eventos.filter(evento => 
      evento.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evento.setor.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [eventos, searchTerm])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Eventos</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os eventos dos clientes
          </p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90" onClick={() => setEditingEvento(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Evento
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEvento ? "Editar Evento" : "Novo Evento"}</DialogTitle>
              <DialogDescription>
                Preencha as informações do evento. Você pode digitar a data no formato dd/mm/aaaa ou usar o calendário.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente *</Label>
                <Popover open={openClienteCombobox} onOpenChange={setOpenClienteCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openClienteCombobox}
                      className="w-full justify-between"
                    >
                      {formData.clienteId
                        ? (() => {
                            const cliente = clientes.find(c => c.id === formData.clienteId)
                            return cliente ? (
                              <span>
                                {cliente.nome_empresarial}
                                {cliente.nome_fantasia && (
                                  <span className="text-muted-foreground"> - {cliente.nome_fantasia}</span>
                                )}
                              </span>
                            ) : "Selecione um cliente"
                          })()
                        : "Selecione um cliente"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar cliente por nome empresarial ou fantasia..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {clientes.map((cliente) => (
                            <CommandItem
                              key={cliente.id}
                              value={`${cliente.nome_empresarial} ${cliente.nome_fantasia || ''}`}
                              onSelect={() => {
                                setFormData(prev => ({...prev, clienteId: cliente.id}))
                                setOpenClienteCombobox(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 shrink-0",
                                  formData.clienteId === cliente.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="truncate">{cliente.nome_empresarial}</span>
                                {cliente.nome_fantasia && (
                                  <span className="text-sm text-muted-foreground truncate">
                                    {cliente.nome_fantasia}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Data *</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="dd/mm/aaaa"
                    value={dateInput}
                    onChange={(e) => handleDateInputChange(e.target.value)}
                    className="flex-1"
                    maxLength={10}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon">
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.data}
                        onSelect={(date) => {
                          setFormData(prev => ({...prev, data: date}))
                          setDateInput(date ? format(date, "dd/MM/yyyy") : "")
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {formData.data && (
                  <p className="text-sm text-muted-foreground">
                    Data selecionada: {format(formData.data, "PPP", { locale: ptBR })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="setor">Setor *</Label>
                <Select 
                  value={formData.setor} 
                  onValueChange={(value) => setFormData(prev => ({...prev, setor: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {setores.map(setor => (
                      <SelectItem key={setor} value={setor}>
                        {setor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  placeholder="Título do evento"
                  value={formData.titulo}
                  onChange={(e) => setFormData(prev => ({...prev, titulo: e.target.value}))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <div className="min-h-[200px]">
                  <ReactQuill
                    theme="snow"
                    value={formData.descricao}
                    onChange={(value) => setFormData(prev => ({...prev, descricao: value}))}
                    placeholder="Descreva o evento..."
                    style={{ height: "150px" }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-16">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-primary hover:opacity-90">
                  {editingEvento ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Use os filtros para encontrar eventos específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por cliente ou setor..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Eventos</CardTitle>
          <CardDescription>
            {eventosFiltrados.length} evento(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando eventos...</p>
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum evento encontrado</p>
              <p className="text-sm">
                {searchTerm ? "Tente um termo de busca diferente" : "Clique em 'Novo Evento' para adicionar"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {eventosFiltrados.map((evento) => (
                <div key={evento.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{evento.clienteNome}</h4>
                    <p className="text-sm text-muted-foreground font-medium">{evento.titulo}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(evento.data, "PPP", { locale: ptBR })} • {evento.setor}
                    </p>
                    <div 
                      className="text-sm text-muted-foreground mt-1 max-w-md truncate"
                      dangerouslySetInnerHTML={{ __html: evento.descricao }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openViewModal(evento)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(evento)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingEvento(evento)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Visualização */}
      <Dialog open={!!viewingEvento} onOpenChange={() => setViewingEvento(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Evento</DialogTitle>
          </DialogHeader>
          
          {viewingEvento && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                <p className="mt-1">{viewingEvento.clienteNome}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Data</Label>
                <p className="mt-1">{format(viewingEvento.data, "PPP", { locale: ptBR })}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Título</Label>
                <p className="mt-1">{viewingEvento.titulo}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Setor</Label>
                <p className="mt-1">{viewingEvento.setor}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Descrição</Label>
                <div 
                  className="mt-1 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: viewingEvento.descricao }}
                />
              </div>
              
              <div className="flex justify-end pt-4">
                <Button onClick={() => setViewingEvento(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingEvento} onOpenChange={() => setDeletingEvento(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir o evento do cliente "{deletingEvento?.clienteNome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}