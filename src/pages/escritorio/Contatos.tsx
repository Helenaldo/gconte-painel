import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Plus, Search, ContactRound, Pencil, Eye, Trash2, Check, ChevronsUpDown, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import InputMask from "react-input-mask"
import { supabase } from "@/integrations/supabase/client"

interface Contato {
  id: string
  clienteId: string
  clienteNome: string
  clienteNomeFantasia?: string
  nome: string
  email: string
  telefone: string
}

export function Contatos() {
  const [contatos, setContatos] = useState<Contato[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isClienteComboOpen, setIsClienteComboOpen] = useState(false)
  const [editingContato, setEditingContato] = useState<Contato | null>(null)
  const [viewingContato, setViewingContato] = useState<Contato | null>(null)
  const [deletingContato, setDeletingContato] = useState<Contato | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    clienteId: "",
    nome: "",
    email: "",
    telefone: ""
  })
  const { toast } = useToast()

  // Carregar clientes e contatos
  useEffect(() => {
    loadClientes()
    loadContatos()
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
    }
  }

  const loadContatos = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          clients!inner(nome_empresarial, nome_fantasia)
        `)
        .order('nome')
      
      if (error) throw error
      
      const contatosFormatados = (data || []).map(contato => ({
        id: contato.id,
        clienteId: contato.client_id,
        clienteNome: contato.clients.nome_empresarial,
        clienteNomeFantasia: contato.clients.nome_fantasia,
        nome: contato.nome,
        email: contato.email,
        telefone: contato.telefone
      }))
      
      setContatos(contatosFormatados)
    } catch (error) {
      console.error('Erro ao carregar contatos:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.clienteId || !formData.nome || !formData.email) {
      toast({
        title: "Erro",
        description: "Cliente, nome e e-mail são obrigatórios",
        variant: "destructive"
      })
      return
    }

    try {
      const contatoData = {
        client_id: formData.clienteId,
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone
      }

      if (editingContato) {
        const { error } = await supabase
          .from('contacts')
          .update(contatoData)
          .eq('id', editingContato.id)
        
        if (error) throw error
        toast({ title: "Sucesso", description: "Contato atualizado com sucesso" })
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert([contatoData])
        
        if (error) throw error
        toast({ title: "Sucesso", description: "Contato cadastrado com sucesso" })
      }

      await loadContatos()
      resetForm()
    } catch (error: any) {
      console.error('Erro ao salvar contato:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar contato",
        variant: "destructive"
      })
    }
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

  const handleDelete = async () => {
    if (deletingContato) {
      try {
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', deletingContato.id)
        
        if (error) throw error
        
        setDeletingContato(null)
        await loadContatos()
        toast({ title: "Sucesso", description: "Contato excluído com sucesso" })
      } catch (error: any) {
        console.error('Erro ao excluir contato:', error)
        toast({
          title: "Erro",
          description: "Erro ao excluir contato",
          variant: "destructive"
        })
      }
    }
  }

  const contatosFiltrados = useMemo(() => {
    if (!searchTerm) return contatos
    
    const termo = searchTerm.toLowerCase()
    return contatos.filter(contato => 
      contato.nome.toLowerCase().includes(termo) ||
      contato.email.toLowerCase().includes(termo) ||
      contato.clienteNome.toLowerCase().includes(termo) ||
      (contato.clienteNomeFantasia && contato.clienteNomeFantasia.toLowerCase().includes(termo))
    )
  }, [contatos, searchTerm])

  const contatosAgrupados = useMemo(() => {
    const grupos: { [clienteId: string]: Contato[] } = {}
    
    contatosFiltrados.forEach(contato => {
      if (!grupos[contato.clienteId]) {
        grupos[contato.clienteId] = []
      }
      grupos[contato.clienteId].push(contato)
    })
    
    return grupos
  }, [contatosFiltrados])

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
                <Popover open={isClienteComboOpen} onOpenChange={setIsClienteComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isClienteComboOpen}
                      className="w-full justify-between"
                    >
                      {formData.clienteId
                        ? clientes.find((cliente) => cliente.id === formData.clienteId)?.nome_empresarial
                        : "Selecione um cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {clientes.map((cliente) => (
                            <CommandItem
                              key={cliente.id}
                              value={`${cliente.nome_empresarial} ${cliente.nome_fantasia || ''}`.toLowerCase()}
                              onSelect={() => {
                                setFormData(prev => ({...prev, clienteId: cliente.id}))
                                setIsClienteComboOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.clienteId === cliente.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div>
                                <div className="font-medium">{cliente.nome_empresarial}</div>
                                {cliente.nome_fantasia && (
                                  <div className="text-sm text-muted-foreground">{cliente.nome_fantasia}</div>
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
                <Label htmlFor="telefone">Telefone</Label>
                <InputMask
                  mask="(99) 99999-9999"
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({...prev, telefone: e.target.value}))}
                >
                  {() => <Input placeholder="(11) 99999-9999" />}
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
                <Input 
                  placeholder="Buscar por empresa, contato ou e-mail..." 
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
          <CardTitle>Lista de Contatos</CardTitle>
          <CardDescription>
            {contatosFiltrados.length} contato(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contatosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ContactRound className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum contato encontrado</p>
              <p className="text-sm">
                {searchTerm ? "Tente um termo de busca diferente" : "Clique em 'Novo Contato' para adicionar"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(contatosAgrupados).map(([clienteId, contatosCliente]) => {
                const primeiroContato = contatosCliente[0]
                const temMultiplosContatos = contatosCliente.length > 1
                
                return (
                  <div key={clienteId} className="space-y-2">
                    {temMultiplosContatos && (
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-medium text-sm">
                          {primeiroContato.clienteNome}
                          {primeiroContato.clienteNomeFantasia && (
                            <span className="text-muted-foreground ml-1">
                              ({primeiroContato.clienteNomeFantasia})
                            </span>
                          )}
                        </h3>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          {contatosCliente.length} contato{contatosCliente.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {contatosCliente.map((contato) => (
                        <div key={contato.id} className={`flex items-center justify-between p-4 border rounded-lg ${temMultiplosContatos ? 'ml-6' : ''}`}>
                          <div className="flex-1">
                            <h4 className="font-medium">{contato.nome}</h4>
                            {!temMultiplosContatos && (
                              <p className="text-sm text-muted-foreground">
                                {contato.clienteNome}
                                {contato.clienteNomeFantasia && (
                                  <span className="text-muted-foreground ml-1">
                                    ({contato.clienteNomeFantasia})
                                  </span>
                                )}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {contato.email} 
                              {contato.telefone && <span> • {contato.telefone}</span>}
                            </p>
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingContato(contato)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
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

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingContato} onOpenChange={() => setDeletingContato(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir o contato "{deletingContato?.nome}"? 
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