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
} from 'chart.js'
import { useTheme } from 'next-themes'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface LineChartProps {
  data: {
    meses: string[]
    valores: number[]
  }
  title: string
  label: string
}

export function LineChart({ data, title, label }: LineChartProps) {
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
        borderColor: 'hsl(219, 82%, 56%)',
        backgroundColor: 'hsl(219, 82%, 56% / 0.1)',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointBackgroundColor: 'hsl(219, 82%, 66%)',
        pointBorderColor: 'hsl(219, 82%, 46%)',
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 3,
        pointShadowColor: 'hsl(219, 82%, 56% / 0.3)',
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
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
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
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
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