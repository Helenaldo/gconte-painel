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
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Calculator, Calendar as CalendarIcon, Pencil, Eye, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface Tributacao {
  id: string
  clienteId: string
  clienteNome: string
  data: Date
  tipo: string
  ativa: boolean
}

const mockClientes = [
  { id: "1", nome: "Empresa ABC Ltda" },
  { id: "2", nome: "XYZ Comércio" },
  { id: "3", nome: "Indústria 123" },
]

const tiposTributacao = [
  "Simples Nacional",
  "Lucro Presumido", 
  "Real Anual",
  "Real Trimestral"
]

const mockTributacoes: Tributacao[] = [
  {
    id: "1",
    clienteId: "1",
    clienteNome: "Empresa ABC Ltda",
    data: new Date(),
    tipo: "Simples Nacional",
    ativa: true
  },
]

export function Tributacao() {
  const [tributacoes, setTributacoes] = useState<Tributacao[]>(mockTributacoes)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTributacao, setEditingTributacao] = useState<Tributacao | null>(null)
  const [viewingTributacao, setViewingTributacao] = useState<Tributacao | null>(null)
  const [deletingTributacao, setDeletingTributacao] = useState<Tributacao | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "ativas" | "inativas">("todas")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    clienteId: "",
    data: undefined as Date | undefined,
    tipo: ""
  })
  const [dateInput, setDateInput] = useState("")
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.clienteId || !formData.data || !formData.tipo) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      })
      return
    }

    const clienteNome = mockClientes.find(c => c.id === formData.clienteId)?.nome || ""

    if (editingTributacao) {
      setTributacoes(prev => prev.map(tributacao => 
        tributacao.id === editingTributacao.id 
          ? { ...tributacao, ...formData, data: formData.data!, clienteNome }
          : tributacao
      ))
      toast({ title: "Sucesso", description: "Tributação atualizada com sucesso" })
    } else {
      // Inativar tributações anteriores do mesmo cliente
      setTributacoes(prev => prev.map(t => 
        t.clienteId === formData.clienteId ? { ...t, ativa: false } : t
      ))

      const novaTributacao: Tributacao = {
        id: Date.now().toString(),
        ...formData,
        data: formData.data!,
        clienteNome,
        ativa: true
      }
      setTributacoes(prev => [...prev, novaTributacao])
      toast({ 
        title: "Sucesso", 
        description: "Tributação cadastrada com sucesso. Tributações anteriores foram inativadas automaticamente."
      })
    }

    resetForm()
  }

  const resetForm = () => {
    setFormData({ clienteId: "", data: undefined, tipo: "" })
    setEditingTributacao(null)
    setIsModalOpen(false)
  }

  const openEditModal = (tributacao: Tributacao) => {
    setFormData({
      clienteId: tributacao.clienteId,
      data: tributacao.data,
      tipo: tributacao.tipo
    })
    setEditingTributacao(tributacao)
    setIsModalOpen(true)
  }

  const openViewModal = (tributacao: Tributacao) => {
    setViewingTributacao(tributacao)
  }

  const handleDelete = () => {
    if (deletingTributacao) {
      setTributacoes(prev => prev.filter(t => t.id !== deletingTributacao.id))
      setDeletingTributacao(null)
      toast({ title: "Sucesso", description: "Tributação excluída com sucesso" })
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

  const tributacoesFiltradas = tributacoes.filter(tributacao => {
    // Filtro por status
    let matchesStatus = true
    if (filtroStatus === "ativas") matchesStatus = tributacao.ativa
    else if (filtroStatus === "inativas") matchesStatus = !tributacao.ativa

    // Filtro por termo de busca
    let matchesSearch = true
    if (searchTerm) {
      matchesSearch = 
        tributacao.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tributacao.tipo.toLowerCase().includes(searchTerm.toLowerCase())
    }

    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tributação</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie a tributação dos clientes
          </p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90" onClick={() => setEditingTributacao(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Tributação
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingTributacao ? "Editar Tributação" : "Nova Tributação"}</DialogTitle>
              <DialogDescription>
                Preencha as informações da tributação. Você pode digitar a data no formato dd/mm/aaaa ou usar o calendário.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cliente">Empresa/Cliente *</Label>
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
                <Label htmlFor="tipo">Tipo de Tributação *</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(value) => setFormData(prev => ({...prev, tipo: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposTributacao.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-primary hover:opacity-90">
                  {editingTributacao ? "Atualizar" : "Cadastrar"}
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
            Use os filtros para encontrar tributações específicas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por cliente ou tipo..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={filtroStatus} onValueChange={(value: any) => setFiltroStatus(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="ativas">Ativas</SelectItem>
                <SelectItem value="inativas">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Tributações</CardTitle>
          <CardDescription>
            {tributacoesFiltradas.length} tributação(ões) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tributacoesFiltradas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma tributação encontrada</p>
              <p className="text-sm">Clique em "Nova Tributação" para adicionar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tributacoesFiltradas.map((tributacao) => (
                <div key={tributacao.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{tributacao.clienteNome}</h4>
                      <Badge variant={tributacao.ativa ? "default" : "secondary"}>
                        {tributacao.ativa ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(tributacao.data, "PPP", { locale: ptBR })} • {tributacao.tipo}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openViewModal(tributacao)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(tributacao)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingTributacao(tributacao)}
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
      <Dialog open={!!viewingTributacao} onOpenChange={() => setViewingTributacao(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Detalhes da Tributação</DialogTitle>
          </DialogHeader>
          
          {viewingTributacao && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                <p className="mt-1">{viewingTributacao.clienteNome}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Data</Label>
                <p className="mt-1">{format(viewingTributacao.data, "PPP", { locale: ptBR })}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Tipo de Tributação</Label>
                <p className="mt-1">{viewingTributacao.tipo}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge variant={viewingTributacao.ativa ? "default" : "secondary"}>
                    {viewingTributacao.ativa ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <Button onClick={() => setViewingTributacao(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingTributacao} onOpenChange={() => setDeletingTributacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir a tributação de "{deletingTributacao?.clienteNome}"? 
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