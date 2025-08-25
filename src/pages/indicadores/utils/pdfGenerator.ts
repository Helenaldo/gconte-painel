import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface PDFData {
  empresa: {
    nome_empresarial: string
    cnpj: string
  }
  periodo: string
  margemLiquidaMesFim: number | null
  margemLiquidaAcumulada: number | null
  fluxoResultados: {
    meses: string[]
    receitas: number[]
    custosEDespesas: number[]
    resultadoLiquido: number[]
  }
  dreResumo: {
    meses: string[]
    data: {
      [linha: string]: number[]
    }
  }
}

export const generateDashboardPDF = async (data: PDFData) => {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  
  // Margem
  const margin = 20
  let yPosition = margin
  
  // Cabeçalho
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Dashboard de Indicadores', margin, yPosition)
  yPosition += 10
  
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`${data.empresa.nome_empresarial}`, margin, yPosition)
  yPosition += 7
  
  pdf.setFontSize(12)
  pdf.text(`CNPJ: ${data.empresa.cnpj}`, margin, yPosition)
  yPosition += 7
  
  pdf.text(`Período: ${data.periodo}`, margin, yPosition)
  yPosition += 15
  
  // Indicadores de Lucratividade
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Indicadores de Lucratividade', margin, yPosition)
  yPosition += 10
  
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  
  if (data.margemLiquidaMesFim !== null) {
    pdf.text(`Margem Líquida (Mês Fim): ${data.margemLiquidaMesFim.toFixed(2)}%`, margin, yPosition)
    yPosition += 7
  }
  
  if (data.margemLiquidaAcumulada !== null) {
    pdf.text(`Margem Líquida Acumulada: ${data.margemLiquidaAcumulada.toFixed(2)}%`, margin, yPosition)
    yPosition += 15
  }
  
  // DRE Resumida
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('DRE Resumida', margin, yPosition)
  yPosition += 10
  
  // Cabeçalho da tabela
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  
  const colWidth = (pageWidth - 2 * margin - 60) / data.dreResumo.meses.length
  
  // Linha do cabeçalho
  pdf.text('Conta', margin, yPosition)
  data.dreResumo.meses.forEach((mes, index) => {
    pdf.text(mes, margin + 60 + (index * colWidth), yPosition)
  })
  yPosition += 7
  
  // Linha separadora
  pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2)
  
  // Dados da tabela
  pdf.setFont('helvetica', 'normal')
  
  Object.entries(data.dreResumo.data).forEach(([linha, valores]) => {
    if (yPosition > pageHeight - 30) {
      pdf.addPage()
      yPosition = margin
    }
    
    pdf.text(linha.substring(0, 25), margin, yPosition) // Limitar texto
    
    valores.forEach((valor, index) => {
      const formatted = valor !== null 
        ? new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL',
            minimumFractionDigits: 0
          }).format(valor)
        : '–'
      
      pdf.text(formatted, margin + 60 + (index * colWidth), yPosition)
    })
    
    yPosition += 6
  })
  
  // Rodapé
  const now = new Date()
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'italic')
  pdf.text(
    `Gerado em: ${now.toLocaleString('pt-BR')}`,
    margin,
    pageHeight - 10
  )
  
  // Salvar PDF
  const fileName = `dashboard-${data.empresa.nome_empresarial.replace(/\s+/g, '-').toLowerCase()}-${data.periodo.replace(/\//g, '-')}.pdf`
  pdf.save(fileName)
}