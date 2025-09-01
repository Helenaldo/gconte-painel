import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { supabase } from "@/integrations/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"

interface Client {
  id: string
  nome_empresarial: string
  cnpj: string
}

interface HistoricItem {
  id: string
  client_id: string
  collaborator_id: string
  setores: string[]
  data_inicio: string
  data_fim: string | null
  status: 'vigente' | 'encerrado'
  created_at: string
  collaborator: {
    id: string
    nome: string
    email: string
  }
}

interface HistoricoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  clients: Client[]
}

const SETOR_COLORS = {
  'Contábil': 'bg-blue-100 text-blue-800 border-blue-200',
  'Fiscal': 'bg-green-100 text-green-800 border-green-200', 
  'Pessoal': 'bg-purple-100 text-purple-800 border-purple-200'
}

export function HistoricoModal({ 
  open, 
  onOpenChange, 
  clientId, 
  clients 
}: HistoricoModalProps) {
  const [loading, setLoading] = useState(false)
  const [historico, setHistorico] = useState<HistoricItem[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>("")

  useEffect(() => {
    if (clientId) {
      setSelectedClientId(clientId)
    }
  }, [clientId])

  useEffect(() => {
    if (open && selectedClientId) {
      loadHistorico()
    }
  }, [open, selectedClientId])

  const loadHistorico = async () => {
    if (!selectedClientId) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('responsible_assignments')
        .select(`
          *,
          collaborator:profiles!collaborator_id(id, nome, email)
        `)
        .eq('client_id', selectedClientId)
        .order('data_inicio', { ascending: false })

      if (error) throw error

      setHistorico((data || []).map((item: any) => ({
        ...item,
        status: item.status as 'vigente' | 'encerrado'
      })))
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)

  // Verificar se o vínculo está vigente
  const isVigente = (item: HistoricItem) => {
    const hoje = new Date()
    const inicio = new Date(item.data_inicio)
    const fim = item.data_fim ? new Date(item.data_fim) : null
    
    return hoje >= inicio && (!fim || hoje <= fim)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Responsáveis</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seletor de Cliente */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cliente</label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    <div>
                      <div className="font-medium">{client.nome_empresarial}</div>
                      <div className="text-sm text-muted-foreground">{client.cnpj}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClient && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium">{selectedClient.nome_empresarial}</h3>
              <p className="text-sm text-muted-foreground">{selectedClient.cnpj}</p>
            </div>
          )}

          {/* Tabela de Histórico */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setores</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Data Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {selectedClientId ? 'Nenhum histórico encontrado' : 'Selecione um cliente'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    historico.map((item) => {
                      const vigente = isVigente(item)
                      const inicio = new Date(item.data_inicio)
                      const fim = item.data_fim ? new Date(item.data_fim) : new Date()
                      const diffTime = Math.abs(fim.getTime() - inicio.getTime())
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.collaborator.nome}</div>
                              <div className="text-sm text-muted-foreground">{item.collaborator.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.setores.map((setor) => (
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
                            {format(inicio, "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {item.data_fim 
                              ? format(new Date(item.data_fim), "dd/MM/yyyy", { locale: ptBR })
                              : "-"
                            }
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={vigente ? "default" : "secondary"}
                              className={vigente ? "bg-green-100 text-green-800" : ""}
                            >
                              {vigente ? "Vigente" : "Encerrado"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {diffDays} dia{diffDays !== 1 ? 's' : ''}
                              {vigente && ' (em andamento)'}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}