import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { useTheme } from 'next-themes'

ChartJS.register(ArcElement, Tooltip, Legend)

interface DoughnutChartProps {
  data: number | null
  label: string
}

export function DoughnutChart({ data, label }: DoughnutChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const chartData = {
    labels: [label, 'Restante'],
    datasets: [
      {
        data: data !== null ? [Math.abs(data), 100 - Math.abs(data)] : [0, 100],
        backgroundColor: [
          data !== null && data >= 0 
            ? 'hsl(142, 71%, 45%)' // success color
            : 'hsl(0, 84%, 60%)',   // destructive color
          isDark ? 'hsl(210, 18%, 20%)' : 'hsl(220, 13%, 91%)'
        ],
        borderColor: [
          data !== null && data >= 0 
            ? 'hsl(142, 71%, 45%)' 
            : 'hsl(0, 84%, 60%)',
          isDark ? 'hsl(210, 18%, 20%)' : 'hsl(220, 13%, 91%)'
        ],
        borderWidth: 2,
      },
    ],
  }

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.5,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(215, 25%, 27%)',
          font: {
            size: 12,
          },
          padding: 20,
          filter: function(legendItem) {
            return legendItem.text !== 'Restante'
          }
        },
      },
      tooltip: {
        backgroundColor: isDark ? 'hsl(210, 22%, 10%)' : 'hsl(0, 0%, 100%)',
        titleColor: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(215, 25%, 27%)',
        bodyColor: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(215, 25%, 27%)',
        borderColor: isDark ? 'hsl(210, 18%, 20%)' : 'hsl(220, 13%, 91%)',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            if (context.label === 'Restante') return ''
            return `${context.label}: ${data?.toFixed(2) || 0}%`
          }
        }
      },
    },
    cutout: '60%',
  }

  if (data === null) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <div className="text-2xl mb-2">–</div>
          <div className="text-sm">Dados não disponíveis</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <Doughnut data={chartData} options={options} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {data.toFixed(2)}%
          </div>
          <div className="text-xs text-muted-foreground">
            {label.split(' ')[0]}
          </div>
        </div>
      </div>
    </div>
  )
}