import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, Building2, TrendingUp } from "lucide-react"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

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
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalColaboradores: 0,
    clientesPorTributacao: {} as Record<string, number>,
    clientesPorRamo: {} as Record<string, number>
  })

  useEffect(() => {
    // Simular carregamento de dados
    const loadData = () => {
      setStats({
        totalClientes: 147,
        totalColaboradores: 12,
        clientesPorTributacao: {
          'Simples Nacional': 89,
          'Lucro Presumido': 34,
          'Lucro Real': 18,
          'Isento/Imune': 6
        },
        clientesPorRamo: {
          'Comércio': 52,
          'Serviços': 41,
          'Indústria': 28,
          'Agronegócio': 15,
          'Tecnologia': 11
        }
      })
    }

    loadData()
  }, [])

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
            <div className="text-2xl font-bold text-warning">142</div>
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