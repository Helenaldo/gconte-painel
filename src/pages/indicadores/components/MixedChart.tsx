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
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(34, 197, 94, 0.8)');
          gradient.addColorStop(1, 'rgba(22, 163, 74, 0.6)');
          return gradient;
        },
        borderColor: 'rgba(22, 163, 74, 1)',
        borderWidth: 1,
        order: 2,
        barThickness: 40,
      },
      {
        type: 'bar' as const,
        label: 'Custos e Despesas',
        data: data.custosEDespesas.map(val => -Math.abs(val)), // Valores negativos para aparecer abaixo do eixo
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
          gradient.addColorStop(1, 'rgba(220, 38, 38, 0.6)');
          return gradient;
        },
        borderColor: 'rgba(220, 38, 38, 1)',
        borderWidth: 1,
        order: 3,
        barThickness: 40,
      },
      {
        type: 'line' as const,
        label: 'Resultado Líquido',
        data: data.resultadoLiquido,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgba(96, 165, 250, 1)',
        pointBorderColor: 'rgba(37, 99, 235, 1)',
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
            let formatted: string
            
            // Para o dataset "Custos e Despesas", o valor é negativo no gráfico mas queremos mostrar positivo na tooltip
            if (context.dataset.label === 'Custos e Despesas') {
              formatted = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(Math.abs(value))
            } else {
              // Para outros datasets (incluindo Resultado Líquido), mostrar o valor com o sinal correto
              formatted = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(value)
            }
            
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