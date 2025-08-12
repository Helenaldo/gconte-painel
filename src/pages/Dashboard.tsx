import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, Building2, TrendingUp } from "lucide-react"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export function Dashboard() {
  const { toast } = useToast()

  type Client = { id: string; nome_empresarial: string; ramo_atividade: string | null; fim_contrato: string | null }

  const [stats, setStats] = useState({
    totalClientes: 0,
    totalColaboradores: 0,
    empresasAtivas: 0,
    clientesPorTributacao: {} as Record<string, number>,
    clientesPorRamo: {} as Record<string, number>,
  })

  const [clients, setClients] = useState<Client[]>([])
  const [semTributacao, setSemTributacao] = useState<Client[]>([])
  const [semContato, setSemContato] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)

  const [openTaxModal, setOpenTaxModal] = useState(false)
  const [selectedClientForTax, setSelectedClientForTax] = useState<Client | null>(null)
  const [taxForm, setTaxForm] = useState({ tipo: '', data: '', valor: '', descricao: '' })

  const [openContactModal, setOpenContactModal] = useState(false)
  const [selectedClientForContact, setSelectedClientForContact] = useState<Client | null>(null)
  const [contactForm, setContactForm] = useState({ nome: '', email: '', telefone: '' })

  const loadAll = async () => {
    setLoading(true)
    try {
      const [
        { data: clientsData, error: clientsError },
        { count: profilesCount, error: profilesError },
        { data: taxationData, error: taxationError },
        { data: contactsData, error: contactsError }
      ] = await Promise.all([
        supabase
          .from('clients')
          .select('id,nome_empresarial,ramo_atividade,fim_contrato')
          .order('nome_empresarial', { ascending: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('taxation').select('id,client_id,tipo,status').eq('status', 'ativa'),
        supabase.from('contacts').select('id,client_id'),
      ])

      if (clientsError || profilesError || taxationError || contactsError) {
        throw new Error(
          clientsError?.message || profilesError?.message || taxationError?.message || contactsError?.message
        )
      }

      const clientsArr = clientsData || []
      setClients(clientsArr)

      // Totais
      const totalClientes = clientsArr.length
      const totalColaboradores = profilesCount || 0

      // Empresas ativas: fim_contrato nulo ou >= hoje
      const today = new Date().toISOString().slice(0, 10)
      const empresasAtivas = clientsArr.filter((c) => !c.fim_contrato || c.fim_contrato >= today).length

      // Clientes por Tributação (apenas status 'ativa')
      const tribCounts: Record<string, number> = {}
      ;(taxationData || []).forEach((t: any) => {
        const label = t.tipo || 'Não informado'
        tribCounts[label] = (tribCounts[label] || 0) + 1
      })

      // Clientes por Ramo
      const ramoCounts: Record<string, number> = {}
      clientsArr.forEach((c) => {
        const label = c.ramo_atividade || 'Não informado'
        ramoCounts[label] = (ramoCounts[label] || 0) + 1
      })

      // Pendências
      const taxedClientIds = new Set((taxationData || []).map((t: any) => t.client_id))
      const clientsSemTrib = clientsArr.filter((c) => !taxedClientIds.has(c.id))
      setSemTributacao(clientsSemTrib)

      const contactedClientIds = new Set((contactsData || []).map((ct: any) => ct.client_id))
      const clientsSemCont = clientsArr.filter((c) => !contactedClientIds.has(c.id))
      setSemContato(clientsSemCont)

      setStats({
        totalClientes,
        totalColaboradores,
        empresasAtivas,
        clientesPorTributacao: tribCounts,
        clientesPorRamo: ramoCounts,
      })
    } catch (err: any) {
      console.error('Erro ao carregar dashboard', err)
      toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

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
      loadAll()
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
      loadAll()
    } catch (err: any) {
      toast({ title: 'Erro ao criar contato', description: err.message, variant: 'destructive' })
    }
  }

  const tributacaoData = {
    labels: Object.keys(stats.clientesPorTributacao),
    datasets: [
      {
        data: Object.values(stats.clientesPorTributacao),
        backgroundColor: [
          'hsl(219, 82%, 56%)',
          'hsl(142, 71%, 45%)',
          'hsl(38, 92%, 50%)',
          'hsl(0, 84%, 60%)'
        ],
        borderWidth: 2,
        borderColor: 'hsl(var(--background))'
      }
    ]
  }

  const ramoData = {
    labels: Object.keys(stats.clientesPorRamo),
    datasets: [
      {
        label: 'Clientes por Ramo',
        data: Object.values(stats.clientesPorRamo),
        backgroundColor: 'hsl(219, 82%, 56%)',
        borderColor: 'hsl(219, 82%, 46%)',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          color: 'hsl(var(--foreground))'
        }
      }
    }
  }

  const doughnutOptions = {
    ...chartOptions,
    cutout: '60%',
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        position: 'right' as const
      }
    }
  }

  const barOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'hsl(var(--muted-foreground))'
        },
        grid: {
          color: 'hsl(var(--border))'
        }
      },
      x: {
        ticks: {
          color: 'hsl(var(--muted-foreground))'
        },
        grid: {
          display: false
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Visão geral do sistema de gestão contábil
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalClientes}</div>
            <p className="text-xs text-muted-foreground">
              +12% em relação ao mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores</CardTitle>
            <UserCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.totalColaboradores}</div>
            <p className="text-xs text-muted-foreground">
              Equipe ativa no sistema
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
            <Building2 className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.empresasAtivas}</div>
            <p className="text-xs text-muted-foreground">
              Empresas com registros ativos
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Crescimento</CardTitle>
            <TrendingUp className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">8.7%</div>
            <p className="text-xs text-muted-foreground">
              Crescimento mensal médio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clientes por Tributação</CardTitle>
            <CardDescription>
              Distribuição dos clientes por regime tributário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Doughnut data={tributacaoData} options={doughnutOptions} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes por Ramo de Atividade</CardTitle>
            <CardDescription>
              Quantidade de clientes por setor de atuação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Bar data={ramoData} options={barOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Pendências de Cadastro</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sem Tributação Definida</CardTitle>
              <CardDescription>Empresas sem tributação ativa cadastrada</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {semTributacao.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma empresa pendente.</p>
              ) : (
                <div className="space-y-2">
                  {semTributacao.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{c.nome_empresarial}</p>
                        <p className="text-xs text-muted-foreground">{c.ramo_atividade || 'Ramo não informado'}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedClientForTax(c)
                          setOpenTaxModal(true)
                        }}
                      >
                        Nova Tributação
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sem Contato Cadastrado</CardTitle>
              <CardDescription>Empresas sem pessoa de contato</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {semContato.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma empresa pendente.</p>
              ) : (
                <div className="space-y-2">
                  {semContato.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{c.nome_empresarial}</p>
                        <p className="text-xs text-muted-foreground">{c.ramo_atividade || 'Ramo não informado'}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedClientForContact(c)
                          setOpenContactModal(true)
                        }}
                      >
                        Novo Contato
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
                  <SelectItem value="Lucro Real">Lucro Real</SelectItem>
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
            <Button onClick={handleCreateTaxation} disabled={loading || !taxForm.tipo || !taxForm.data}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button
              onClick={handleCreateContact}
              disabled={loading || !contactForm.nome || !contactForm.email || !contactForm.telefone}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cards Informativos Adicionais */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próximos Vencimentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">DAS - Janeiro</span>
              <span className="text-sm text-warning font-medium">20/02/2024</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">FGTS - Janeiro</span>
              <span className="text-sm text-success font-medium">07/02/2024</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">INSS - Janeiro</span>
              <span className="text-sm text-destructive font-medium">15/02/2024</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atividades Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <p className="font-medium">Novo cliente cadastrado</p>
              <p className="text-muted-foreground">Empresa XYZ Ltda - há 2 horas</p>
            </div>
            <div className="text-sm">
              <p className="font-medium">Relatório gerado</p>
              <p className="text-muted-foreground">Balancete mensal - há 4 horas</p>
            </div>
            <div className="text-sm">
              <p className="font-medium">Backup realizado</p>
              <p className="text-muted-foreground">Sistema atualizado - há 1 dia</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Servidor</span>
              <span className="text-sm text-success font-medium">Online</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Database</span>
              <span className="text-sm text-success font-medium">Conectado</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Última atualização</span>
              <span className="text-sm text-muted-foreground">Agora</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}