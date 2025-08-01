import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Search, Calendar as CalendarIcon, Pencil, Eye, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import ReactQuill from "react-quill"
import "react-quill/dist/quill.snow.css"

interface Evento {
  id: string
  clienteId: string
  clienteNome: string
  data: Date
  setor: string
  descricao: string
}

const mockClientes = [
  { id: "1", nome: "Empresa ABC Ltda" },
  { id: "2", nome: "XYZ Comércio" },
  { id: "3", nome: "Indústria 123" },
]

const setores = [
  "Contábil",
  "Fiscal", 
  "Pessoal",
  "Societário",
  "Financeiro",
  "Outro"
]

const mockEventos: Evento[] = [
  {
    id: "1",
    clienteId: "1",
    clienteNome: "Empresa ABC Ltda",
    data: new Date(),
    setor: "Contábil",
    descricao: "Entrega de documentos contábeis"
  },
]

export function Eventos() {
  const [eventos, setEventos] = useState<Evento[]>(mockEventos)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null)
  const [viewingEvento, setViewingEvento] = useState<Evento | null>(null)
  const [deletingEvento, setDeletingEvento] = useState<Evento | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    clienteId: "",
    data: undefined as Date | undefined,
    setor: "",
    descricao: ""
  })
  const [dateInput, setDateInput] = useState("")
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.clienteId || !formData.data || !formData.setor || !formData.descricao) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      })
      return
    }

    const clienteNome = mockClientes.find(c => c.id === formData.clienteId)?.nome || ""

    if (editingEvento) {
      setEventos(prev => prev.map(evento => 
        evento.id === editingEvento.id 
          ? { ...evento, ...formData, data: formData.data!, clienteNome }
          : evento
      ))
      toast({ title: "Sucesso", description: "Evento atualizado com sucesso" })
    } else {
      const novoEvento: Evento = {
        id: Date.now().toString(),
        ...formData,
        data: formData.data!,
        clienteNome
      }
      setEventos(prev => [...prev, novoEvento])
      toast({ title: "Sucesso", description: "Evento cadastrado com sucesso" })
    }

    resetForm()
  }

  const resetForm = () => {
    setFormData({ clienteId: "", data: undefined, setor: "", descricao: "" })
    setEditingEvento(null)
    setIsModalOpen(false)
  }

  const openEditModal = (evento: Evento) => {
    setFormData({
      clienteId: evento.clienteId,
      data: evento.data,
      setor: evento.setor,
      descricao: evento.descricao
    })
    setEditingEvento(evento)
    setIsModalOpen(true)
  }

  const openViewModal = (evento: Evento) => {
    setViewingEvento(evento)
  }

  const handleDelete = () => {
    if (deletingEvento) {
      setEventos(prev => prev.filter(e => e.id !== deletingEvento.id))
      setDeletingEvento(null)
      toast({ title: "Sucesso", description: "Evento excluído com sucesso" })
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
                <Select 
                  value={formData.clienteId} 
                  onValueChange={(value) => setFormData(prev => ({...prev, clienteId: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockClientes.map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          {eventosFiltrados.length === 0 ? (
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