import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { useTheme } from 'next-themes'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
)

interface MixedChartProps {
  data: {
    meses: string[]
    receitas: number[]
    custosEDespesas: number[]
    resultadoLiquido: number[]
  }
}

export function MixedChart({ data }: MixedChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const chartData = {
    labels: data.meses,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Receitas',
        data: data.receitas,
        backgroundColor: 'hsl(142, 71%, 45%)',
        borderColor: 'hsl(142, 71%, 45%)',
        borderWidth: 1,
        order: 2,
        barThickness: 40,
      },
      {
        type: 'bar' as const,
        label: 'Custos e Despesas',
        data: data.custosEDespesas.map(val => -Math.abs(val)), // Valores negativos para aparecer abaixo do eixo
        backgroundColor: 'hsl(0, 84%, 60%)',
        borderColor: 'hsl(0, 84%, 60%)',
        borderWidth: 1,
        order: 3,
        barThickness: 40,
      },
      {
        type: 'line' as const,
        label: 'Resultado Líquido',
        data: data.resultadoLiquido,
        borderColor: 'hsl(219, 82%, 56%)',
        backgroundColor: 'hsl(219, 82%, 56%)',
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        fill: false,
        order: 1,
        tension: 0.3,
      },
    ],
  }

  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: isDark ? 'hsl(210, 18%, 20%)' : 'hsl(220, 13%, 91%)',
        },
        ticks: {
          color: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(215, 25%, 27%)',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: {
          color: isDark ? 'hsl(210, 18%, 20%)' : 'hsl(220, 13%, 91%)',
        },
        ticks: {
          color: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(215, 25%, 27%)',
          callback: function(value) {
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value as number)
          }
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(215, 25%, 27%)',
          font: {
            size: 12,
          },
          padding: 20,
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
            const value = context.parsed.y
            const formatted = new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(Math.abs(value))
            
            return `${context.dataset.label}: ${formatted}`
          }
        }
      },
    },
    elements: {
      bar: {
        borderSkipped: false,
      }
    }
  }

  if (data.meses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className="text-sm">Nenhum dado disponível para o período</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-64">
      <Chart type="bar" data={chartData} options={options} />
    </div>
  )
}