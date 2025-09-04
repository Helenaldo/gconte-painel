import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogTrigger, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Search, Users, Pencil, UserX, History, ArrowRightLeft, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/context/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { ResponsavelForm } from "@/components/responsaveis/ResponsavelForm"
import { TransferirModal } from "@/components/responsaveis/TransferirModal"
import { HistoricoModal } from "@/components/responsaveis/HistoricoModal"

interface ResponsibleAssignment {
  id: string
  client_id: string
  collaborator_id: string
  setores: string[]
  data_inicio: string
  data_fim: string | null
  status: 'vigente' | 'encerrado'
  created_at: string
  updated_at: string
  client: {
    id: string
    nome_empresarial: string
    cnpj: string
  }
  collaborator: {
    id: string
    nome: string
    email: string
  }
}

interface Client {
  id: string
  nome_empresarial: string
  cnpj: string
}

interface Collaborator {
  id: string
  nome: string
  email: string
}

const SETORES = ['Contábil', 'Fiscal', 'Pessoal'] as const
const SETOR_COLORS = {
  'Contábil': 'bg-blue-100 text-blue-800 border-blue-200',
  'Fiscal': 'bg-green-100 text-green-800 border-green-200', 
  'Pessoal': 'bg-purple-100 text-purple-800 border-purple-200'
}

export function Responsaveis() {
  const [assignments, setAssignments] = useState<ResponsibleAssignment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [collaboratorFilter, setCollaboratorFilter] = useState<string>("all")
  const [setorFilter, setSetorFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("vigente")
  const [currentPage, setCurrentPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<ResponsibleAssignment | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false)
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<string>("")
  
  const itemsPerPage = 10
  const { profile } = useAuth()
  const { toast } = useToast()
  const isAdmin = profile?.role === 'administrador'

  // Carregar dados
  const loadData = async () => {
    setLoading(true)
    try {
      const [assignmentsRes, clientsRes, collaboratorsRes] = await Promise.all([
        supabase
          .from('responsible_assignments')
          .select(`
            *,
            client:clients!client_id(id, nome_empresarial, cnpj),
            collaborator:profiles!collaborator_id(id, nome, email)
          `)
          .order('data_inicio', { ascending: false }),
        supabase
          .from('clients')
          .select('id, nome_empresarial, cnpj')
          .order('nome_empresarial'),
        supabase
          .from('profiles')
          .select('id, nome, email')
          .neq('status', 'inativo')
          .order('nome')
      ])

      if (assignmentsRes.error) throw assignmentsRes.error
      if (clientsRes.error) throw clientsRes.error
      if (collaboratorsRes.error) throw collaboratorsRes.error

      setAssignments((assignmentsRes.data || []).map((item: any) => ({
        ...item,
        status: item.status as 'vigente' | 'encerrado'
      })))
      setClients(clientsRes.data || [])
      setCollaborators(collaboratorsRes.data || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtrar assignments
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = 
      assignment.client.nome_empresarial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.client.cnpj.includes(searchTerm) ||
      assignment.collaborator.nome.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesClient = clientFilter === "all" || assignment.client_id === clientFilter
    const matchesCollaborator = collaboratorFilter === "all" || assignment.collaborator_id === collaboratorFilter
    const matchesSetor = setorFilter === "all" || assignment.setores.includes(setorFilter)
    const matchesStatus = statusFilter === "all" || assignment.status === statusFilter
    
    return matchesSearch && matchesClient && matchesCollaborator && matchesSetor && matchesStatus
  })

  // Paginação
  const totalPages = Math.ceil(filteredAssignments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedAssignments = filteredAssignments.slice(startIndex, startIndex + itemsPerPage)

  // Reset da página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, clientFilter, collaboratorFilter, setorFilter, statusFilter])

  // Abrir modal de formulário
  const openForm = (assignment?: ResponsibleAssignment) => {
    setEditingAssignment(assignment || null)
    setIsFormOpen(true)
  }

  // Encerrar vínculo
  const encerrarVinculo = async (assignmentId: string, dataFim: string) => {
    try {
      const { error } = await supabase
        .from('responsible_assignments')
        .update({
          data_fim: dataFim,
          status: 'encerrado',
          ended_by: profile?.id,
          ended_at: new Date().toISOString()
        })
        .eq('id', assignmentId)

      if (error) throw error

      await loadData()
      toast({
        title: "Sucesso",
        description: "Vínculo encerrado com sucesso"
      })
    } catch (error) {
      console.error('Erro ao encerrar vínculo:', error)
      toast({
        title: "Erro",
        description: "Erro ao encerrar vínculo",
        variant: "destructive"
      })
    }
  }

  // Verificar se o vínculo está vigente
  const isVigente = (assignment: ResponsibleAssignment) => {
    const hoje = new Date()
    const inicio = parseISO(assignment.data_inicio)
    const fim = assignment.data_fim ? parseISO(assignment.data_fim) : null
    
    return hoje >= inicio && (!fim || hoje <= fim)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Responsáveis</h1>
        <Button onClick={() => openForm()} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Vínculo
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Empresa, CNPJ ou Colaborador"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa</label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nome_empresarial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Colaborador</label>
              <Select value={collaboratorFilter} onValueChange={setCollaboratorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {collaborators.map(collaborator => (
                    <SelectItem key={collaborator.id} value={collaborator.id}>
                      {collaborator.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Setor</label>
              <Select value={setorFilter} onValueChange={setSetorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {SETORES.map(setor => (
                    <SelectItem key={setor} value={setor}>
                      {setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("")
                  setClientFilter("all")
                  setCollaboratorFilter("all")
                  setSetorFilter("all")
                  setStatusFilter("vigente")
                }}
                className="w-full"
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vínculos de Responsabilidade
            </span>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setTransferModalOpen(true)}
                className="gap-2"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transferir
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Setores</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Data Fim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum vínculo encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{assignment.client.nome_empresarial}</div>
                          <div className="text-sm text-muted-foreground">{assignment.client.cnpj}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{assignment.collaborator.nome}</div>
                          <div className="text-sm text-muted-foreground">{assignment.collaborator.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {assignment.setores.map((setor) => (
                            <Badge
                              key={setor}
                              variant="outline"
                              className={SETOR_COLORS[setor as keyof typeof SETOR_COLORS]}
                            >
                              {setor}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(assignment.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {assignment.data_fim 
                          ? format(parseISO(assignment.data_fim), "dd/MM/yyyy", { locale: ptBR })
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={isVigente(assignment) ? "default" : "secondary"}
                          className={isVigente(assignment) ? "bg-green-100 text-green-800" : ""}
                        >
                          {isVigente(assignment) ? "Vigente" : "Encerrado"}
                        </Badge>
                      </TableCell>
                       <TableCell className="text-right">
                         <div className="flex items-center justify-end gap-2">
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => openForm(assignment)}
                               >
                                 <Pencil className="h-4 w-4" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>Editar vínculo</p>
                             </TooltipContent>
                           </Tooltip>
                           
                           {isVigente(assignment) && (
                             <AlertDialog>
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <AlertDialogTrigger asChild>
                                     <Button variant="ghost" size="sm">
                                       <UserX className="h-4 w-4" />
                                     </Button>
                                   </AlertDialogTrigger>
                                 </TooltipTrigger>
                                 <TooltipContent>
                                   <p>Encerrar vínculo</p>
                                 </TooltipContent>
                               </Tooltip>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>Encerrar Vínculo</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     Deseja encerrar o vínculo de {assignment.collaborator.nome} com {assignment.client.nome_empresarial}?
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                   <AlertDialogAction
                                     onClick={() => encerrarVinculo(assignment.id, new Date().toISOString().split('T')[0])}
                                   >
                                     Encerrar
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                           )}
                           
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => {
                                   setSelectedClientForHistory(assignment.client_id)
                                   setHistoricoModalOpen(true)
                                 }}
                               >
                                 <History className="h-4 w-4" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>Ver histórico</p>
                             </TooltipContent>
                           </Tooltip>
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
                Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredAssignments.length)} de {filteredAssignments.length} vínculos
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modais */}
      <ResponsavelForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        assignment={editingAssignment}
        clients={clients}
        collaborators={collaborators}
        onSave={loadData}
      />

      {isAdmin && (
        <TransferirModal
          open={transferModalOpen}
          onOpenChange={setTransferModalOpen}
          clients={clients}
          collaborators={collaborators}
          onSave={loadData}
        />
      )}

      <HistoricoModal
        open={historicoModalOpen}
        onOpenChange={setHistoricoModalOpen}
        clientId={selectedClientForHistory}
        clients={clients}
      />
    </div>
    </TooltipProvider>
  )
}