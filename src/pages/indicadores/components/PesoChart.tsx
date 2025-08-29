import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TooltipItem
} from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { useTheme } from 'next-themes'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface PesoChartProps {
  data: {
    meses: string[]
    valoresAbsolutos: number[]
    valoresPercentuais: number[]
    labelAbsoluto: string
    labelPercentual: string
  }
  maxPercentage?: number
}

export function PesoChart({ data, maxPercentage = 100 }: PesoChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  console.log('🎯 PesoChart recebeu dados:', data)

  if (!data || !data.meses || data.meses.length === 0) {
    console.log('❌ PesoChart: Dados inválidos ou vazios')
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum dado disponível para exibir
      </div>
    )
  }

  console.log('✅ PesoChart: Dados válidos encontrados, renderizando gráfico')
  console.log('📊 Valores Absolutos:', data.valoresAbsolutos)
  console.log('📈 Valores Percentuais:', data.valoresPercentuais)

  // Definir cores específicas para cada tipo de indicador
  const getColors = (labelAbsoluto: string) => {
    switch (labelAbsoluto) {
      case 'Custos':
        return {
          barBackground: (context: any) => {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(34, 197, 94, 0.8)'); // Verde
            gradient.addColorStop(1, 'rgba(22, 163, 74, 0.6)');
            return gradient;
          },
          barBorder: 'rgba(22, 163, 74, 1)',
          lineColor: 'rgba(21, 128, 61, 1)', // Verde mais escuro
          lineBackground: 'rgba(34, 197, 94, 0.1)'
        }
      case 'Despesas':
        return {
          barBackground: (context: any) => {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)'); // Vermelho
            gradient.addColorStop(1, 'rgba(220, 38, 38, 0.6)');
            return gradient;
          },
          barBorder: 'rgba(220, 38, 38, 1)',
          lineColor: 'rgba(185, 28, 28, 1)', // Vermelho mais escuro
          lineBackground: 'rgba(239, 68, 68, 0.1)'
        }
      case 'Tributos':
        return {
          barBackground: (context: any) => {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(251, 146, 60, 0.8)'); // Laranja
            gradient.addColorStop(1, 'rgba(249, 115, 22, 0.6)');
            return gradient;
          },
          barBorder: 'rgba(249, 115, 22, 1)',
          lineColor: 'rgba(234, 88, 12, 1)', // Laranja mais escuro
          lineBackground: 'rgba(251, 146, 60, 0.1)'
        }
      case 'Folha e Encargos':
      default:
        return {
          barBackground: (context: any) => {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)'); // Roxo
            gradient.addColorStop(1, 'rgba(124, 58, 237, 0.6)');
            return gradient;
          },
          barBorder: 'rgba(124, 58, 237, 1)',
          lineColor: 'rgba(109, 40, 217, 1)', // Roxo mais escuro
          lineBackground: 'rgba(139, 92, 246, 0.1)'
        }
    }
  }

  const colors = getColors(data.labelAbsoluto)

  const chartData = {
    labels: data.meses,
    datasets: [
      // Barras - Valores Absolutos
      {
        type: 'bar' as const,
        label: data.labelAbsoluto,
        data: data.valoresAbsolutos,
        backgroundColor: colors.barBackground,
        borderColor: colors.barBorder,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
        yAxisID: 'y-currency',
        order: 2
      },
      // Linha - Percentuais
      {
        type: 'line' as const,
        label: data.labelPercentual,
        data: data.valoresPercentuais,
        borderColor: colors.lineColor,
        backgroundColor: colors.lineBackground,
        borderWidth: 4,
        pointBackgroundColor: colors.lineColor,
        pointBorderColor: isDark ? 'hsl(var(--background))' : 'hsl(var(--card))',
        pointBorderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        fill: true,
        tension: 0.4,
        yAxisID: 'y-percentage',
        order: 1
      }
    ]
  }

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 20,
          color: isDark ? 'hsl(210 40% 85%)' : 'hsl(222.2 84% 4.9%)',
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
      tooltip: {
        backgroundColor: isDark ? 'hsl(222.2 84% 4.9%)' : 'hsl(0 0% 100%)',
        titleColor: isDark ? 'hsl(210 40% 85%)' : 'hsl(222.2 84% 4.9%)',
        bodyColor: isDark ? 'hsl(210 40% 85%)' : 'hsl(222.2 84% 4.9%)',
        borderColor: isDark ? 'hsl(217.2 32.6% 17.5%)' : 'hsl(214.3 31.8% 91.4%)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context: TooltipItem<'bar' | 'line'>) {
            const label = context.dataset.label || '';
            
            if (context.dataset.yAxisID === 'y-currency') {
              // Formato de moeda para valores absolutos
              return `${label}: ${Number(context.parsed.y).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              })}`;
            } else {
              // Formato percentual
              return `${label}: ${Number(context.parsed.y).toFixed(2)}%`;
            }
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: isDark ? 'hsl(215.4 16.3% 46.9%)' : 'hsl(215.4 16.3% 56.9%)',
          font: {
            size: 11,
          },
          maxRotation: 0,
        },
      },
      'y-currency': {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Valores (R$)',
          color: isDark ? 'hsl(210 40% 85%)' : 'hsl(222.2 84% 4.9%)',
          font: {
            size: 12,
            weight: 600,
          },
        },
        grid: {
          color: isDark ? 'hsla(217.2 32.6% 17.5%, 0.3)' : 'hsla(214.3 31.8% 91.4%, 0.8)',
          drawBorder: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: isDark ? 'hsl(215.4 16.3% 46.9%)' : 'hsl(215.4 16.3% 56.9%)',
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return Number(value).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              notation: 'compact',
              minimumFractionDigits: 0,
              maximumFractionDigits: 1
            });
          }
        },
      },
      'y-percentage': {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        min: 0,
        max: maxPercentage,
        title: {
          display: true,
          text: 'Percentual (%)',
          color: isDark ? 'hsl(210 40% 85%)' : 'hsl(222.2 84% 4.9%)',
          font: {
            size: 12,
            weight: 600,
          },
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: isDark ? 'hsl(215.4 16.3% 46.9%)' : 'hsl(215.4 16.3% 56.9%)',
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return `${Number(value).toFixed(1)}%`;
          }
        },
      },
    },
    elements: {
      bar: {
        borderRadius: 8,
      },
      line: {
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
      },
      point: {
        hoverBorderWidth: 3,
        hoverRadius: 8,
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart' as const,
    },
  }

  return (
    <div className="w-full h-64">
      <Chart type="bar" data={chartData} options={options} />
    </div>
  )
}