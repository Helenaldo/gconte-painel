import { useState, useEffect } from "react"
import { CalendarIcon, Filter, RotateCcw, FileText, AlertTriangle, CheckCircle, ChevronRight, ChevronDown, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import jsPDF from "jspdf"

interface ContaValidacao {
  id: string
  codigo: string
  nome: string
  nivel: number
  valorParametrizado: number
  valorCalculado: number
  diferenca: number
  status: 'consistente' | 'inconsistente'
  filhas: ContaValidacao[]
  mes: number
  ano: number
  empresa: string
}

interface BalancoValidacao {
  mes: number
  ano: number
  empresa: string
  ativo: number
  passivo: number
  receitas: number
  custoseDespesas: number
  diferencaPatrimonial: number
  diferencaResultado: number
  isConsistente: boolean
}

export function Dados() {
  const { toast } = useToast()
  const [empresas, setEmpresas] = useState<{cnpj: string, nome: string}[]>([])
  const [empresaSelecionada, setEmpresaSelecionada] = useState("")
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(false)
  const [contasValidacao, setContasValidacao] = useState<ContaValidacao[]>([])
  const [balancoValidacao, setBalancoValidacao] = useState<BalancoValidacao[]>([])
  const [anos, setAnos] = useState<string[]>([])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [planoContasData, setPlanoContasData] = useState<any[]>([])
  const [parametrizacoesData, setParametrizacoesData] = useState<any[]>([])
  const [contasBalanceteData, setContasBalanceteData] = useState<any[]>([])

  useEffect(() => {
    loadEmpresas()
    loadAnos()
  }, [])

  const loadEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('balancetes')
        .select('cnpj, empresa')
        .neq('status', 'pendente')

      if (error) throw error

      const empresasUnicas = data.reduce((acc: {cnpj: string, nome: string}[], item) => {
        if (!acc.find(e => e.cnpj === item.cnpj)) {
          acc.push({ cnpj: item.cnpj, nome: item.empresa })
        }
        return acc
      }, [])

      setEmpresas(empresasUnicas)
    } catch (error) {
      toast({
        title: "Erro ao carregar empresas",
        description: "Não foi possível carregar a lista de empresas",
        variant: "destructive"
      })
    }
  }

  const loadAnos = async () => {
    try {
      const { data, error } = await supabase
        .from('balancetes')
        .select('ano')
        .neq('status', 'pendente')

      if (error) throw error

      const anosUnicos = [...new Set(data.map(item => item.ano.toString()))]
        .sort((a, b) => parseInt(b) - parseInt(a))

      setAnos(anosUnicos)
    } catch (error) {
      console.error("Erro ao carregar anos:", error)
    }
  }

  const calcularValidacoes = async () => {
    if (!empresaSelecionada || !anoSelecionado) {
      toast({
        title: "Filtros obrigatórios",
        description: "Selecione empresa e ano para calcular as validações",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      // Buscar balancetes da empresa/ano selecionados (incluindo os que estão parametrizando)
      const { data: balancetes, error: balancetesError } = await supabase
        .from('balancetes')
        .select('*')
        .eq('cnpj', empresaSelecionada)
        .eq('ano', parseInt(anoSelecionado))
        .in('status', ['parametrizado', 'parametrizando'])
        .order('mes')

      if (balancetesError) throw balancetesError

      if (balancetes.length === 0) {
        toast({
          title: "Nenhum balancete encontrado",
          description: "Não foram encontrados balancetes parametrizados para os filtros selecionados",
          variant: "destructive"
        })
        setLoading(false)
        return
      }

      // Buscar plano de contas
      const { data: planoContas, error: planoError } = await supabase
        .from('plano_contas')
        .select('*')
        .order('codigo')

      if (planoError) throw planoError

      // Buscar parametrizações
      const { data: parametrizacoes, error: paramError } = await supabase
        .from('parametrizacoes')
        .select('*')
        .eq('empresa_cnpj', empresaSelecionada)

      if (paramError) throw paramError

      const validacoesContas: ContaValidacao[] = []
      const validacoesBalanco: BalancoValidacao[] = []

      // Buscar todas as contas do balancete de todos os meses para usar nos detalhes
      const todasContasBalancete = []
      
      // Para cada mês do ano
      for (const balancete of balancetes) {
        // Buscar contas do balancete
        const { data: contasBalancete, error: contasError } = await supabase
          .from('contas_balancete')
          .select('*')
          .eq('balancete_id', balancete.id)

        if (contasError) throw contasError

        // Adicionar informação do mês/ano às contas do balancete
        const contasComMes = contasBalancete.map(cb => ({
          ...cb,
          mes: balancete.mes,
          ano: balancete.ano
        }))
        todasContasBalancete.push(...contasComMes)

        // Calcular validações hierárquicas
        const contasHierarquicas = calcularHierarquiaContas(
          planoContas, 
          parametrizacoes, 
          contasBalancete, 
          balancete.mes, 
          parseInt(anoSelecionado), 
          balancete.empresa
        )
        validacoesContas.push(...contasHierarquicas)

        // Calcular validação do balanço
        const validacaoBalanco = calcularValidacaoBalanco(
          planoContas,
          parametrizacoes,
          contasBalancete,
          balancete.mes,
          parseInt(anoSelecionado),
          balancete.empresa
        )
        validacoesBalanco.push(validacaoBalanco)
      }
      
      setContasBalanceteData(todasContasBalancete)

      setContasValidacao(validacoesContas)
      setBalancoValidacao(validacoesBalanco)
      setPlanoContasData(planoContas)
      setParametrizacoesData(parametrizacoes)

      toast({
        title: "Validações calculadas",
        description: "As validações foram calculadas com sucesso"
      })
    } catch (error) {
      console.error("Erro ao calcular validações:", error)
      toast({
        title: "Erro ao calcular validações",
        description: "Não foi possível calcular as validações",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const calcularHierarquiaContas = (
    planoContas: any[],
    parametrizacoes: any[],
    contasBalancete: any[],
    mes: number,
    ano: number,
    empresa: string
  ): ContaValidacao[] => {
    const validacoes: ContaValidacao[] = []

    // Organizar contas por hierarquia (níveis 1, 2, 3, 4)
    const contasPorNivel = {
      1: planoContas.filter(c => c.codigo.split('.').length === 1),
      2: planoContas.filter(c => c.codigo.split('.').length === 2),
      3: planoContas.filter(c => c.codigo.split('.').length === 3),
      4: planoContas.filter(c => c.codigo.split('.').length === 4)
    }

    // Calcular valores para cada nível (começando do nível 4 para cima)
    for (let nivel = 4; nivel >= 1; nivel--) {
      for (const conta of contasPorNivel[nivel] || []) {
        // Verificar se a conta tem filhas
        const contasFilhas = planoContas.filter(c => 
          c.codigo.startsWith(conta.codigo + '.') && 
          c.codigo.split('.').length === conta.codigo.split('.').length + 1
        )
        
        // Apenas validar contas que têm filhas (contas mães)
        if (contasFilhas.length > 0) {
          const valorParametrizado = calcularValorParametrizado(conta, parametrizacoes, contasBalancete)
          const valorCalculado = calcularSomaFilhas(conta, planoContas, parametrizacoes, contasBalancete)
          const diferenca = Math.abs(valorParametrizado - valorCalculado)
          
          validacoes.push({
            id: conta.id,
            codigo: conta.codigo,
            nome: conta.nome,
            nivel,
            valorParametrizado,
            valorCalculado,
            diferenca,
            status: diferenca < 0.01 ? 'consistente' : 'inconsistente',
            filhas: [],
            mes,
            ano,
            empresa
          })
        }
      }
    }

    return validacoes
  }

  const determinarNatureza = (conta: any, saldo: number = 0) => {
    // Regra especial para Lucro ou Prejuízos Acumulados
    if (conta.codigo === '2.3.3') {
      return saldo >= 0 ? 'devedora' : 'credora' // Saldo positivo = devedora, saldo negativo = credora
    }
    
    // Verificar todas as contas de receita PRIMEIRO (código 3)
    if (conta.codigo?.startsWith('3')) {
      // Exceção: Deduções da Receita é conta redutora (devedora)
      if (conta.codigo === '3.1.2') {
        return 'devedora'
      }
      return 'credora' // Todas as outras receitas são credoras
    }
    
    // Verificar primeiro por código específico para Patrimônio Líquido
    if (conta.codigo?.startsWith('2.3')) {
      return 'credora' // Capital Social, Reservas, etc. são sempre credoras
    }
    
    if (conta.tipo === 'ativo') {
      // Contas de ativo são devedoras, exceto contas redutoras
      return (conta.nome?.includes('( - )') || conta.nome?.includes('Deprecia') || conta.nome?.includes('Amortiza')) ? 'credora' : 'devedora'
    } else if (conta.tipo === 'passivo') {
      return 'credora'
    } else if (conta.tipo === 'receita') {
      return 'credora'
    } else if (conta.tipo === 'despesa' || conta.tipo === 'custo') {
      return 'devedora'
    }
    return 'devedora' // padrão
  }

  const calcularValorParametrizado = (conta: any, parametrizacoes: any[], contasBalancete: any[]) => {
    const contasParam = parametrizacoes.filter(p => p.plano_conta_id === conta.id)
    const valorBruto = contasParam.reduce((total, param) => {
      const contaBalancete = contasBalancete.find(cb => cb.codigo === param.conta_balancete_codigo)
      return total + (contaBalancete?.saldo_atual || 0)
    }, 0)
    
    // Aplicar sinal baseado na natureza correta da conta, passando o valor bruto para análise
    const natureza = determinarNatureza(conta, valorBruto)
    return natureza === 'credora' ? -valorBruto : valorBruto
  }

  const calcularSomaFilhas = (contaMae: any, planoContas: any[], parametrizacoes: any[], contasBalancete: any[]) => {
    const contasFilhas = planoContas.filter(c => 
      c.codigo.startsWith(contaMae.codigo + '.') && 
      c.codigo.split('.').length === contaMae.codigo.split('.').length + 1
    )
    
    return contasFilhas.reduce((total, filha) => {
      const valorFilha = calcularValorParametrizado(filha, parametrizacoes, contasBalancete)
      return total + valorFilha
    }, 0)
  }

  // Função específica para cálculo de valores na validação do balanço
  const calcularValorParametrizadoBalanco = (conta: any, parametrizacoes: any[], contasBalancete: any[]) => {
    const contasParam = parametrizacoes.filter(p => p.plano_conta_id === conta.id)
    const valorBruto = contasParam.reduce((total, param) => {
      const contaBalancete = contasBalancete.find(cb => cb.codigo === param.conta_balancete_codigo)
      return total + (contaBalancete?.saldo_atual || 0)
    }, 0)
    
    // Para validação do balanço: todas as contas aparecem com valor absoluto (positivo)
    // exceto custos e despesas que mantêm o sinal original se positivo
    if (conta.codigo === '4') { // Custos e despesas
      return Math.abs(valorBruto)
    }
    return Math.abs(valorBruto) // Ativo, Passivo e Receitas sempre positivos na validação do balanço
  }

  const calcularValidacaoBalanco = (
    planoContas: any[],
    parametrizacoes: any[],
    contasBalancete: any[],
    mes: number,
    ano: number,
    empresa: string
  ): BalancoValidacao => {
    // Buscar diretamente os valores parametrizados das contas principais (nível 1)
    const contaAtivo = planoContas.find(c => c.codigo === '1')
    const contaPassivo = planoContas.find(c => c.codigo === '2')
    const contaReceitas = planoContas.find(c => c.codigo === '3')
    const contaCustos = planoContas.find(c => c.codigo === '4')

    const ativo = contaAtivo ? calcularValorParametrizadoBalanco(contaAtivo, parametrizacoes, contasBalancete) : 0
    const passivo = contaPassivo ? calcularValorParametrizadoBalanco(contaPassivo, parametrizacoes, contasBalancete) : 0
    const receitas = contaReceitas ? calcularValorParametrizadoBalanco(contaReceitas, parametrizacoes, contasBalancete) : 0
    const custoseDespesas = contaCustos ? calcularValorParametrizadoBalanco(contaCustos, parametrizacoes, contasBalancete) : 0

    const diferencaPatrimonial = ativo - passivo
    const diferencaResultado = receitas - custoseDespesas
    const isConsistente = Math.abs(diferencaPatrimonial - diferencaResultado) < 0.01

    return {
      mes,
      ano,
      empresa,
      ativo,
      passivo,
      receitas,
      custoseDespesas,
      diferencaPatrimonial,
      diferencaResultado,
      isConsistente
    }
  }

  const calcularValorGrupo = (prefixo: string, planoContas: any[], parametrizacoes: any[], contasBalancete: any[]) => {
    // Somar apenas as contas de nível 4 (analíticas) para evitar duplicação
    const contasAnaliticas = planoContas.filter(c => 
      c.codigo.startsWith(prefixo + '.') && 
      c.codigo.split('.').length === 4
    )
    return contasAnaliticas.reduce((total, conta) => {
      return total + calcularValorParametrizado(conta, parametrizacoes, contasBalancete)
    }, 0)
  }

  const gerarPDFBalancete = async (validacao: BalancoValidacao) => {
    try {
      // Buscar dados do balancete para o mês específico
      const balanceteDoMes = contasBalanceteData.filter(cb => 
        cb.mes === validacao.mes && cb.ano === validacao.ano
      )

      // Buscar empresa
      const empresa = empresas.find(e => e.cnpj === empresaSelecionada)
      
      if (!empresa) {
        toast({
          title: "Erro",
          description: "Empresa não encontrada",
          variant: "destructive"
        })
        return
      }

      // Criar PDF
      const pdf = new jsPDF()
      
      // Configurar fonte
      pdf.setFont('helvetica')
      
      // Cabeçalho
      pdf.setFontSize(16)
      pdf.text('BALANCETE DE VERIFICAÇÃO', 105, 20, { align: 'center' })
      
      pdf.setFontSize(12)
      pdf.text(`Empresa: ${empresa.nome}`, 20, 35)
      pdf.text(`CNPJ: ${empresa.cnpj}`, 20, 45)
      pdf.text(`Período: ${validacao.mes.toString().padStart(2, '0')}/${validacao.ano}`, 20, 55)
      
      // Cabeçalho da tabela
      let yPosition = 75
      pdf.setFontSize(10)
      pdf.text('CÓDIGO', 20, yPosition)
      pdf.text('CONTA', 50, yPosition)
      pdf.text('VALOR', 160, yPosition)
      
      // Linha separadora
      pdf.line(20, yPosition + 3, 190, yPosition + 3)
      yPosition += 10
      
      // Buscar todas as contas do plano com valores parametrizados
      const contasComValor = planoContasData
        .filter(conta => {
          const parametrizacoes = parametrizacoesData.filter(p => p.plano_conta_id === conta.id)
          return parametrizacoes.length > 0
        })
        .map(conta => {
          const valorParametrizado = calcularValorParametrizado(conta, parametrizacoesData, balanceteDoMes)
          return {
            codigo: conta.codigo,
            nome: conta.nome,
            valor: valorParametrizado
          }
        })
        .filter(conta => Math.abs(conta.valor) > 0.01) // Apenas contas com saldo
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
      
      // Adicionar contas ao PDF
      contasComValor.forEach(conta => {
        if (yPosition > 280) { // Nova página se necessário
          pdf.addPage()
          yPosition = 20
        }
        
        pdf.text(conta.codigo, 20, yPosition)
        
        // Limitar o nome da conta para caber na página
        const nomeFormatado = conta.nome.length > 50 ? 
          conta.nome.substring(0, 50) + '...' : conta.nome
        pdf.text(nomeFormatado, 50, yPosition)
        
        // Valor formatado
        const valorFormatado = formatarMoeda(conta.valor)
        pdf.text(valorFormatado, 160, yPosition)
        
        yPosition += 8
      })
      
      // Salvar PDF
      const nomeArquivo = `balancete_${empresa.nome.replace(/\s+/g, '_')}_${validacao.mes.toString().padStart(2, '0')}_${validacao.ano}.pdf`
      pdf.save(nomeArquivo)
      
      toast({
        title: "PDF gerado com sucesso!",
        description: `Balancete de ${validacao.mes.toString().padStart(2, '0')}/${validacao.ano} foi baixado`
      })
      
    } catch (error) {
      console.error("Erro ao gerar PDF:", error)
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o balancete em PDF",
        variant: "destructive"
      })
    }
  }

  const exportarRelatorio = async () => {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "A exportação de relatórios será implementada em breve"
    })
  }

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2 
    })
  }

  const toggleExpandRow = (rowId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId)
    } else {
      newExpanded.add(rowId)
    }
    setExpandedRows(newExpanded)
  }

  const getContasFilhasDetalhadas = (conta: ContaValidacao, mes: number) => {
    // Buscar os dados do balancete específico para este mês
    const contasFilhas = planoContasData.filter(c => 
      c.codigo.startsWith(conta.codigo + '.') && 
      c.codigo.split('.').length === conta.codigo.split('.').length + 1
    )

    // Buscar balancete do mês específico
    const balanceteDoMes = contasBalanceteData.filter(cb => 
      cb.mes === mes && cb.ano === conta.ano
    )

    return contasFilhas.map(filha => {
      const valorParametrizado = calcularValorParametrizado(filha, parametrizacoesData, balanceteDoMes)
      const parametrizacoes = parametrizacoesData.filter(p => p.plano_conta_id === filha.id)
      
      // Calcular o saldo bruto da conta filha para determinar a natureza correta
      const contasParam = parametrizacoes
      const valorBruto = contasParam.reduce((total, param) => {
        const contaBalancete = balanceteDoMes.find(cb => cb.codigo === param.conta_balancete_codigo)
        return total + (contaBalancete?.saldo_atual || 0)
      }, 0)
      
      // Usar a função determinarNatureza passando o saldo bruto para contas especiais
      const natureza = determinarNatureza(filha, valorBruto)
      
      return {
        ...filha,
        natureza, // usar a natureza correta determinada acima
        valorParametrizado,
        parametrizacoes: parametrizacoes.map(param => {
          const contaBalancete = balanceteDoMes.find(cb => cb.codigo === param.conta_balancete_codigo)
          return {
            ...param,
            saldoAtual: contaBalancete?.saldo_atual || 0,
            nomeContaBalancete: contaBalancete?.nome || param.conta_balancete_nome
          }
        })
      }
    })
  }

  const renderDetalhesCalculo = (conta: ContaValidacao) => {
    const contasFilhas = getContasFilhasDetalhadas(conta, conta.mes)
    
    return (
      <div className="bg-muted/50 p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações da Conta Mãe */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Conta Mãe
            </h4>
            <div className="bg-background rounded-md p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Código:</span>
                <span className="text-sm">{conta.codigo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Nome:</span>
                <span className="text-sm">{conta.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Valor Registrado:</span>
                <span className="text-sm font-bold text-blue-600">{formatarMoeda(conta.valorParametrizado)}</span>
              </div>
            </div>
          </div>

          {/* Resumo do Cálculo */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Resumo do Cálculo
            </h4>
            <div className="bg-background rounded-md p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Soma das Filhas:</span>
                <span className="text-sm font-bold text-green-600">{formatarMoeda(conta.valorCalculado)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Diferença:</span>
                <span className={`text-sm font-bold ${conta.diferenca > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatarMoeda(conta.diferenca)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={conta.status === 'consistente' ? 'default' : 'destructive'} className="text-xs">
                  {conta.status === 'consistente' ? 'Consistente' : 'Inconsistente'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Lista das Contas Filhas */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Contas Filhas Utilizadas no Cálculo
          </h4>
          <div className="space-y-2">
            {contasFilhas.map((filha, index) => (
              <div 
                key={index} 
                className="bg-background rounded-md p-3 border-l-4 border-l-blue-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{filha.codigo} - {filha.nome}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {filha.natureza === 'devedora' ? 'Devedora (+)' : 'Credora (-)'}
                      </Badge>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="secondary" className="text-xs">
                              {filha.parametrizacoes?.length || 0} parametrizações
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              {filha.parametrizacoes?.map((param, idx) => (
                                <div key={idx} className="text-xs">
                                  {param.conta_balancete_codigo}: {formatarMoeda(param.saldoAtual)}
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${filha.valorParametrizado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatarMoeda(filha.valorParametrizado)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderDetalhesBalanco = (validacao: BalancoValidacao) => {
    const diferencaTotal = Math.abs(validacao.diferencaPatrimonial - validacao.diferencaResultado)
    
    return (
      <div className="bg-muted/50 p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lado Esquerdo: Patrimônio */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Equação Patrimonial
            </h4>
            <div className="bg-background rounded-md p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">1. Ativo:</span>
                <span className="text-sm font-bold text-blue-600">{formatarMoeda(validacao.ativo)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">2. Passivo:</span>
                <span className="text-sm font-bold text-red-600">{formatarMoeda(validacao.passivo)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">(Ativo - Passivo):</span>
                  <span className="text-sm font-bold text-purple-600">{formatarMoeda(validacao.diferencaPatrimonial)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lado Direito: Resultado */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Equação de Resultado
            </h4>
            <div className="bg-background rounded-md p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">3. Receitas:</span>
                <span className="text-sm font-bold text-green-600">{formatarMoeda(validacao.receitas)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">4. Custos e Despesas:</span>
                <span className="text-sm font-bold text-red-600">{formatarMoeda(validacao.custoseDespesas)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">(Receitas - Custos):</span>
                  <span className="text-sm font-bold text-purple-600">{formatarMoeda(validacao.diferencaResultado)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resultado Final */}
        <div className="bg-background rounded-md p-4 border-2 border-dashed border-muted-foreground/20">
          <div className="text-center space-y-2">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Validação da Equação Fundamental
            </h4>
            <div className="text-lg font-mono">
              <span className="text-purple-600">{formatarMoeda(validacao.diferencaPatrimonial)}</span>
              <span className="mx-2">=</span>
              <span className="text-purple-600">{formatarMoeda(validacao.diferencaResultado)}</span>
            </div>
            <div className={`text-sm font-medium ${diferencaTotal < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
              Diferença: {formatarMoeda(diferencaTotal)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const contasInconsistentes = contasValidacao.filter(c => c.status === 'inconsistente').length
  const balancosInconsistentes = balancoValidacao.filter(b => !b.isConsistente).length

  return (
    <div className="container mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dados do aplicativo GCONTE PAINEL</h1>
          <p className="text-muted-foreground">
            Verificação e validação das parametrizações baseadas no Plano de Contas Padrão
          </p>
        </div>
        <Button onClick={exportarRelatorio} variant="outline">
          <FileText className="h-4 w-4 mr-2" />
          Exportar Relatório PDF
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecione a empresa e o ano para análise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa</label>
              <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.cnpj} value={empresa.cnpj}>
                      {empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={ano}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={calcularValidacoes} 
                disabled={loading || !empresaSelecionada || !anoSelecionado}
                className="w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                {loading ? "Calculando..." : "Filtrar Dados"}
              </Button>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={calcularValidacoes} 
                variant="outline"
                disabled={loading}
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Recalcular Validações
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo das Validações */}
      {(contasValidacao.length > 0 || balancoValidacao.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Contas Analisadas</p>
                  <p className="text-2xl font-bold">{contasValidacao.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Contas Inconsistentes</p>
                  <p className="text-2xl font-bold text-destructive">{contasInconsistentes}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Meses Analisados</p>
                  <p className="text-2xl font-bold">{balancoValidacao.length}</p>
                </div>
                <CalendarIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Balanços Inconsistentes</p>
                  <p className="text-2xl font-bold text-destructive">{balancosInconsistentes}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Validação do Balanço */}
      {balancoValidacao.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Validação do Balanço (Ativo - Passivo) = (Receitas - Custos e Despesas)</CardTitle>
            <CardDescription>Verificação mensal da equação patrimonial</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Passivo</TableHead>
                    <TableHead>Receitas</TableHead>
                    <TableHead>Custos e Despesas</TableHead>
                    <TableHead>Diferença Patrimonial</TableHead>
                    <TableHead>Diferença Resultado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balancoValidacao.map((validacao, index) => {
                    const rowId = `balanco-${index}`
                    const isExpanded = expandedRows.has(rowId)
                    
                    return (
                      <>
                        <TableRow key={index} className={!validacao.isConsistente ? 'bg-destructive/10' : ''}>
                          <TableCell>
                            {!validacao.isConsistente && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpandRow(rowId)}
                                className="h-6 w-6 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {validacao.mes.toString().padStart(2, '0')}/{validacao.ano}
                          </TableCell>
                          <TableCell>{formatarMoeda(validacao.ativo)}</TableCell>
                          <TableCell>{formatarMoeda(validacao.passivo)}</TableCell>
                          <TableCell>{formatarMoeda(validacao.receitas)}</TableCell>
                          <TableCell>{formatarMoeda(validacao.custoseDespesas)}</TableCell>
                          <TableCell>{formatarMoeda(validacao.diferencaPatrimonial)}</TableCell>
                          <TableCell>{formatarMoeda(validacao.diferencaResultado)}</TableCell>
                          <TableCell>
                            {validacao.isConsistente ? (
                              <Badge variant="default" className="bg-green-600">
                                Consistente
                              </Badge>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="destructive">
                                      Inconsistente
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Diferença: {formatarMoeda(Math.abs(validacao.diferencaPatrimonial - validacao.diferencaResultado))}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => gerarPDFBalancete(validacao)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Gerar PDF do Balancete de {validacao.mes.toString().padStart(2, '0')}/{validacao.ano}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                        
                        {!validacao.isConsistente && isExpanded && (
                          <TableRow>
                            <TableCell colSpan={10} className="p-0">
                              {renderDetalhesBalanco(validacao)}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validação Hierárquica das Contas */}
      {contasValidacao.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Validação Hierárquica das Contas (Mãe = Soma das Filhas)</CardTitle>
            <CardDescription>Verificação da consistência entre contas mãe e suas filhas</CardDescription>
          </CardHeader>
          <CardContent>
            {contasInconsistentes === 0 ? (
              // Mensagem de sucesso quando não há inconsistências
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                  Parametrização Consistente! 🎉
                </h3>
                <p className="text-lg text-green-600 dark:text-green-300 mb-4">
                  Todas as contas estão corretamente parametrizadas
                </p>
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-6 max-w-md mx-auto">
                  <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">
                    A validação hierárquica confirma que não há inconsistências entre as contas mãe e suas filhas. 
                    Os indicadores e dashboards podem ser analisados com confiança.
                  </p>
                </div>
              </div>
            ) : (
              // Tabela de inconsistências (código existente)
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Mês</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead>Valor Parametrizado</TableHead>
                        <TableHead>Valor Calculado</TableHead>
                        <TableHead>Diferença</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contasValidacao
                        .filter(c => c.status === 'inconsistente')
                        .slice(0, 20)
                        .map((conta, index) => {
                          const rowId = `conta-${conta.id}-${conta.mes}-${conta.ano}`
                          const isExpanded = expandedRows.has(rowId)
                          
                          return (
                            <>
                              <TableRow key={index} className="bg-destructive/10">
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpandRow(rowId)}
                                    className="h-6 w-6 p-0"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {conta.mes.toString().padStart(2, '0')}/{conta.ano}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{conta.codigo} - {conta.nome}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">Nível {conta.nivel}</Badge>
                                </TableCell>
                                <TableCell>{formatarMoeda(conta.valorParametrizado)}</TableCell>
                                <TableCell>{formatarMoeda(conta.valorCalculado)}</TableCell>
                                <TableCell className="text-destructive font-medium">
                                  {formatarMoeda(conta.diferenca)}
                                </TableCell>
                                <TableCell>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="destructive">
                                          Inconsistente
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Diferença entre valor da conta mãe e a soma de suas contas filhas: {formatarMoeda(conta.diferenca)}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                              </TableRow>
                              
                              {isExpanded && (
                                <TableRow>
                                  <TableCell colSpan={8} className="p-0">
                                    {renderDetalhesCalculo(conta)}
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          )
                        })}
                    </TableBody>
                  </Table>
                </div>
                
                {contasValidacao.filter(c => c.status === 'inconsistente').length > 20 && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Mostrando apenas as primeiras 20 inconsistências. Total de contas inconsistentes: {contasInconsistentes}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado vazio */}
      {contasValidacao.length === 0 && balancoValidacao.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Nenhuma validação calculada</h3>
                <p>Selecione uma empresa e ano, depois clique em "Filtrar Dados" para iniciar as validações</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}