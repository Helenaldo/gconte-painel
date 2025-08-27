import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { useTheme } from 'next-themes'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface AreaChartProps {
  data: {
    meses: string[]
    valores: number[]
  }
  title: string
  label: string
}

export function AreaChart({ data, title, label }: AreaChartProps) {
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
        borderColor: 'hsl(var(--primary))',
        backgroundColor: 'hsl(var(--primary) / 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointBackgroundColor: 'hsl(var(--primary))',
        pointBorderColor: 'hsl(var(--primary))',
        pointRadius: 4,
        pointHoverRadius: 6,
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
      <Line data={chartData} options={options} />
    </div>
  )
}