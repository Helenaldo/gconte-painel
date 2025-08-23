import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, UserPlus, Users, Shield, User, Edit, Trash2, UserX, UserCheck, Key } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/context/auth-context"
import ResponsavelKanban from "@/components/collaborator/ResponsavelKanban"

interface Colaborador {
  id: string
  nome: string
  email: string
  avatar_url?: string
  role: 'operador' | 'administrador'
  status: 'ativo' | 'inativo'
  created_at: string
}

interface Invitation {
  id: string
  email: string
  nome: string
  role: 'operador' | 'administrador'
  created_at: string
  expires_at: string
  used_at?: string
}

export function Colaboradores() {
  const { profile } = useAuth()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  
  // Check if current user is administrator
  const isAdmin = profile?.role === 'administrador'
  
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    role: "operador" as 'operador' | 'administrador',
    password: "",
    avatar: null as File | null
  })

  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: ""
  })
  
  const { toast } = useToast()

  useEffect(() => {
    loadColaboradores()

    // deep-link open view modal
    const sp = new URLSearchParams(window.location.search)
    const rid = sp.get('responsavel_id')
    if (rid) {
      setTimeout(() => {
        const c = colaboradores.find((x) => x.id === rid)
        if (c) openViewModal(c)
      }, 400)
    }
  }, [])

  const loadColaboradores = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setColaboradores((data || []).map(item => ({
        ...item,
        status: item.status as 'ativo' | 'inativo'
      })))
    } catch (error: any) {
      console.error('Erro ao carregar colaboradores:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar colaboradores",
        variant: "destructive"
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nome || !formData.email || !formData.password) {
      toast({
        title: "Erro",
        description: "Nome, e-mail e senha são obrigatórios",
        variant: "destructive"
      })
      return
    }

    if (formData.password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    try {
      // Create collaborator directly
      const { error } = await supabase.functions.invoke('create-collaborator', {
        body: {
          nome: formData.nome,
          email: formData.email,
          role: formData.role,
          password: formData.password
        }
      })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: `Colaborador ${formData.nome} cadastrado com sucesso`,
      })

      setFormData({
        nome: "",
        email: "",
        role: "operador",
        password: "",
        avatar: null
      })
      
      setIsModalOpen(false)
      await loadColaboradores()
      
    } catch (error: any) {
      console.error('Erro ao cadastrar colaborador:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao cadastrar colaborador",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateColaborador = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedColaborador) return
    
    setLoading(true)
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: formData.nome,
          role: formData.role
        })
        .eq('id', selectedColaborador.id)
      
      if (error) throw error

      // Update user_roles table
      await supabase
        .from('user_roles')
        .update({ role: formData.role })
        .eq('user_id', selectedColaborador.id)

      toast({
        title: "Sucesso",
        description: "Colaborador atualizado com sucesso"
      })

      setIsEditModalOpen(false)
      await loadColaboradores()
      
    } catch (error: any) {
      console.error('Erro ao atualizar colaborador:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar colaborador",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (colaborador: Colaborador) => {
    const newStatus = colaborador.status === 'ativo' ? 'inativo' : 'ativo'
    setLoading(true)
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', colaborador.id)
      
      if (error) throw error

      toast({
        title: "Sucesso",
        description: `Colaborador ${newStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso`
      })

      await loadColaboradores()
      
    } catch (error: any) {
      console.error('Erro ao alterar status:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao alterar status do colaborador",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteColaborador = async (colaborador: Colaborador) => {
    if (!confirm(`Tem certeza que deseja excluir ${colaborador.nome}? Esta ação não pode ser desfeita.`)) {
      return
    }
    
    setLoading(true)
    
    try {
      // Use the delete-collaborator edge function to properly delete from all tables
      const { error } = await supabase.functions.invoke('delete-collaborator', {
        body: {
          userId: colaborador.id,
          userEmail: colaborador.email
        }
      })
      
      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Colaborador excluído com sucesso de todas as tabelas"
      })

      await loadColaboradores()
      
    } catch (error: any) {
      console.error('Erro ao excluir colaborador:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir colaborador",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const resendInvitation = async (invitation: Invitation) => {
    setLoading(true)
    
    try {
      const { error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: invitation.email,
          nome: invitation.nome,
          role: invitation.role
        }
      })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: `Novo convite enviado para ${invitation.email}`,
      })
      
    } catch (error: any) {
      console.error('Erro ao reenviar convite:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao reenviar convite",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (colaborador: Colaborador) => {
    setSelectedColaborador(colaborador)
    setFormData({
      nome: colaborador.nome,
      email: colaborador.email,
      role: colaborador.role,
      password: "",
      avatar: null
    })
    setIsEditModalOpen(true)
  }

  const openViewModal = (colaborador: Colaborador) => {
    setSelectedColaborador(colaborador)
    setIsViewOpen(true)
  }

  const openPasswordModal = (colaborador: Colaborador) => {
    setSelectedColaborador(colaborador)
    setPasswordData({
      password: "",
      confirmPassword: ""
    })
    setIsPasswordModalOpen(true)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedColaborador) return
    
    if (!passwordData.password || !passwordData.confirmPassword) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      })
      return
    }

    if (passwordData.password !== passwordData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive"
      })
      return
    }

    if (passwordData.password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    try {
      const { error } = await supabase.functions.invoke('manage-password', {
        body: {
          userId: selectedColaborador.id,
          newPassword: passwordData.password,
          userEmail: selectedColaborador.email
        }
      })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: `Senha ${passwordData.password ? 'alterada' : 'criada'} com sucesso para ${selectedColaborador.nome}`
      })

      setIsPasswordModalOpen(false)
      setPasswordData({
        password: "",
        confirmPassword: ""
      })
      
    } catch (error: any) {
      console.error('Erro ao gerenciar senha:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerenciar senha",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nome: "",
      email: "",
      role: "operador",
      password: "",
      avatar: null
    })
  }

  const filteredColaboradores = colaboradores.filter(colaborador => {
    const matchesSearch = colaborador.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         colaborador.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || colaborador.role === roleFilter
    const matchesStatus = statusFilter === "all" || colaborador.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Colaboradores</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os colaboradores do escritório
          </p>
        </div>
        
        {isAdmin && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90" onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Colaborador
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Colaborador</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({...prev, nome: e.target.value}))}
                    placeholder="Nome completo"
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
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
                    placeholder="Digite a senha (mínimo 6 caracteres)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Nível de Acesso</Label>
                  <Select value={formData.role} onValueChange={(value: 'operador' | 'administrador') => setFormData(prev => ({...prev, role: value}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operador">
                        <div className="flex items-center">
                          <User className="mr-2 h-4 w-4" />
                          Operador
                        </div>
                      </SelectItem>
                      <SelectItem value="administrador">
                        <div className="flex items-center">
                          <Shield className="mr-2 h-4 w-4" />
                          Administrador
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} className="bg-gradient-primary hover:opacity-90">
                    <UserPlus className="mr-2 h-4 w-4" />
                    {loading ? "Cadastrando..." : "Cadastrar Colaborador"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Pesquisar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            <SelectItem value="operador">Operador</SelectItem>
            <SelectItem value="administrador">Administrador</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Collaborators Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Colaboradores Ativos ({filteredColaboradores.length})
          </CardTitle>
          <CardDescription>
            Lista de todos os colaboradores cadastrados
            {!isAdmin && (
              <span className="block mt-2 text-amber-600">
                <Shield className="inline mr-1 h-4 w-4" />
                Apenas administradores podem gerenciar colaboradores
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColaboradores.map((colaborador) => (
                <TableRow key={colaborador.id} className={colaborador.status === 'inativo' ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={colaborador.avatar_url} />
                        <AvatarFallback>{colaborador.nome.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{colaborador.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>{colaborador.email}</TableCell>
                  <TableCell>
                    <Badge variant={colaborador.role === 'administrador' ? 'destructive' : 'secondary'}>
                      {colaborador.role === 'administrador' ? (
                        <><Shield className="mr-1 h-3 w-3" /> Admin</>
                      ) : (
                        <><User className="mr-1 h-3 w-3" /> Operador</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={colaborador.status === 'ativo' ? 'default' : 'secondary'}>
                      {colaborador.status === 'ativo' ? (
                        <><UserCheck className="mr-1 h-3 w-3" /> Ativo</>
                      ) : (
                        <><UserX className="mr-1 h-3 w-3" /> Inativo</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(colaborador.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openViewModal(colaborador)}
                        title="Ver processos do colaborador"
                      >
                        Ver
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(colaborador)}
                            title="Editar colaborador"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPasswordModal(colaborador)}
                            title="Criar/alterar senha"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(colaborador)}
                            disabled={loading || colaborador.id === profile?.id}
                            title={colaborador.status === 'ativo' ? 'Desativar colaborador' : 'Ativar colaborador'}
                          >
                            {colaborador.status === 'ativo' ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteColaborador(colaborador)}
                            disabled={loading || colaborador.id === profile?.id}
                            className="text-destructive hover:text-destructive"
                            title="Excluir colaborador"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredColaboradores.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum colaborador encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {isAdmin && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Colaborador</DialogTitle>
            </DialogHeader>
            {/* ... keep existing code (form) */}
            <form onSubmit={handleUpdateColaborador} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome *</Label>
                <Input
                  id="edit-nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({...prev, nome: e.target.value}))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input id="edit-email" type="email" value={formData.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Nível de Acesso</Label>
                <Select value={formData.role} onValueChange={(value: 'operador' | 'administrador') => setFormData(prev => ({...prev, role: value}))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador"><div className="flex items-center"><User className="mr-2 h-4 w-4" />Operador</div></SelectItem>
                    <SelectItem value="administrador"><div className="flex items-center"><Shield className="mr-2 h-4 w-4" />Administrador</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading} className="bg-gradient-primary hover:opacity-90">{loading ? "Salvando..." : "Salvar Alterações"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* View Modal (Responsável por) */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Processos de {selectedColaborador?.nome}</DialogTitle>
          </DialogHeader>
          {selectedColaborador && (
            <ResponsavelKanban responsavelId={selectedColaborador.id} responsavelNome={selectedColaborador.nome} />
          )}
        </DialogContent>
      </Dialog>

      {/* Password Modal */}
      {isAdmin && (
        <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar/Alterar Senha</DialogTitle>
            </DialogHeader>
            
            {selectedColaborador && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedColaborador.avatar_url} />
                      <AvatarFallback>{selectedColaborador.nome.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedColaborador.nome}</p>
                      <p className="text-muted-foreground">{selectedColaborador.email}</p>
                    </div>
                  </div>
                </div>
                
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova Senha *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={passwordData.password}
                      onChange={(e) => setPasswordData(prev => ({...prev, password: e.target.value}))}
                      placeholder="Digite a nova senha (mínimo 6 caracteres)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({...prev, confirmPassword: e.target.value}))}
                      placeholder="Confirme a nova senha"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsPasswordModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="bg-gradient-primary hover:opacity-90">
                      <Key className="mr-2 h-4 w-4" />
                      {loading ? "Salvando..." : "Salvar Senha"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}