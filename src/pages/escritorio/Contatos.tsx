import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Search, ContactRound, Pencil, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import InputMask from "react-input-mask"

interface Contato {
  id: string
  clienteId: string
  clienteNome: string
  nome: string
  email: string
  telefone: string
}

const mockClientes = [
  { id: "1", nome: "Empresa ABC Ltda" },
  { id: "2", nome: "XYZ Comércio" },
  { id: "3", nome: "Indústria 123" },
]

const mockContatos: Contato[] = [
  {
    id: "1",
    clienteId: "1",
    clienteNome: "Empresa ABC Ltda",
    nome: "João Silva",
    email: "joao@empresaabc.com",
    telefone: "(11) 99999-9999"
  },
]

export function Contatos() {
  const [contatos, setContatos] = useState<Contato[]>(mockContatos)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContato, setEditingContato] = useState<Contato | null>(null)
  const [viewingContato, setViewingContato] = useState<Contato | null>(null)
  const [formData, setFormData] = useState({
    clienteId: "",
    nome: "",
    email: "",
    telefone: ""
  })
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.clienteId || !formData.nome || !formData.email || !formData.telefone) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      })
      return
    }

    const clienteNome = mockClientes.find(c => c.id === formData.clienteId)?.nome || ""

    if (editingContato) {
      setContatos(prev => prev.map(contato => 
        contato.id === editingContato.id 
          ? { ...contato, ...formData, clienteNome }
          : contato
      ))
      toast({ title: "Sucesso", description: "Contato atualizado com sucesso" })
    } else {
      const novoContato: Contato = {
        id: Date.now().toString(),
        ...formData,
        clienteNome
      }
      setContatos(prev => [...prev, novoContato])
      toast({ title: "Sucesso", description: "Contato cadastrado com sucesso" })
    }

    resetForm()
  }

  const resetForm = () => {
    setFormData({ clienteId: "", nome: "", email: "", telefone: "" })
    setEditingContato(null)
    setIsModalOpen(false)
  }

  const openEditModal = (contato: Contato) => {
    setFormData({
      clienteId: contato.clienteId,
      nome: contato.nome,
      email: contato.email,
      telefone: contato.telefone
    })
    setEditingContato(contato)
    setIsModalOpen(true)
  }

  const openViewModal = (contato: Contato) => {
    setViewingContato(contato)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contatos</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os contatos dos clientes
          </p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90" onClick={() => setEditingContato(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Contato
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingContato ? "Editar Contato" : "Novo Contato"}</DialogTitle>
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
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({...prev, nome: e.target.value}))}
                  placeholder="Nome do contato"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <InputMask
                  mask="(99) 99999-9999"
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({...prev, telefone: e.target.value}))}
                >
                  <Input placeholder="(11) 99999-9999" />
                </InputMask>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-primary hover:opacity-90">
                  {editingContato ? "Atualizar" : "Cadastrar"}
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
            Use os filtros para encontrar contatos específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou email..." className="pl-10" />
              </div>
            </div>
            <Button variant="outline">Filtrar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Contatos</CardTitle>
          <CardDescription>
            {contatos.length} contato(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contatos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ContactRound className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum contato cadastrado</p>
              <p className="text-sm">Clique em "Novo Contato" para adicionar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contatos.map((contato) => (
                <div key={contato.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{contato.nome}</h4>
                    <p className="text-sm text-muted-foreground">{contato.clienteNome}</p>
                    <p className="text-sm text-muted-foreground">{contato.email} • {contato.telefone}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openViewModal(contato)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(contato)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Visualização */}
      <Dialog open={!!viewingContato} onOpenChange={() => setViewingContato(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Contato</DialogTitle>
          </DialogHeader>
          
          {viewingContato && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                <p className="mt-1">{viewingContato.clienteNome}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Nome</Label>
                <p className="mt-1">{viewingContato.nome}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">E-mail</Label>
                <p className="mt-1">{viewingContato.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Telefone</Label>
                <p className="mt-1">{viewingContato.telefone}</p>
              </div>
              
              <div className="flex justify-end pt-4">
                <Button onClick={() => setViewingContato(null)}>
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