import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { useTheme } from 'next-themes'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface BarChartProps {
  data: {
    meses: string[]
    valores: number[]
  }
  title: string
  label: string
}

export function BarChart({ data, title, label }: BarChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  if (!data || !data.meses || data.meses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum dado disponível para exibir
      </div>
    )
  }

  const chartData = {
    labels: data.meses,
    datasets: [
      {
        label: label,
        data: data.valores,
        backgroundColor: 'hsl(var(--primary) / 0.8)',
        borderColor: 'hsl(var(--primary))',
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isDark ? '#ffffff' : '#000000',
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y
            return `${context.dataset.label}: ${value.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL' 
            })}`
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: isDark ? '#ffffff' : '#000000',
          callback: function(value: any) {
            return value.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              notation: 'compact'
            })
          }
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        ticks: {
          color: isDark ? '#ffffff' : '#000000',
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
  }

  return (
    <div className="h-64">
      <Bar data={chartData} options={options} />
    </div>
  )
}