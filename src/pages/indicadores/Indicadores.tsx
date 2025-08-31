import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Search, Calculator, ChevronDown, ChevronRight, Info, Save } from "lucide-react"

interface Empresa {
  cnpj: string
  nome_empresarial: string
}

interface BalanceteData {
  ano: number
  mes: number
  contas: { [codigo: string]: number }
}

interface IndicadorData {
  [mes: string]: number | null
}

export function Indicadores() {
  const { toast } = useToast()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("")
  const [anoSelecionado, setAnoSelecionado] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)
  const [indicadores, setIndicadores] = useState<{ [nome: string]: IndicadorData }>({})
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([])
  const [mesesExibidos, setMesesExibidos] = useState<string[]>([])
  const [indicadorExpandido, setIndicadorExpandido] = useState<string | null>(null)
  const [mesSelecionado, setMesSelecionado] = useState<string>("")
  const [dadosDetalhados, setDadosDetalhados] = useState<{ [mes: number]: { [codigoPlano: string]: { saldo_atual: number; saldo_anterior: number } } }>({})

  // Lista de indicadores contábeis e financeiros
  const nomeIndicadores = [
    "Liquidez Corrente",
    "Liquidez Seca", 
    "Liquidez Geral",
    "Participação de Capitais de Terceiros (PCT)",
    "Composição do Endividamento (CE)",
    "Imobilização do Patrimônio Líquido (IPL)",
    "Margem Bruta (%)",
    "Margem Líquida (%)",
    "Margem Líquida Acumulada (%)",
    "Giro do Ativo",
    "Prazo Médio de Pagamento (PMP)",
    "Prazo Médio de Estocagem (PME)",
    "Prazo Médio de Recebimento (PMR)",
    "Ciclo Operacional (CO)",
    "Ciclo Financeiro (CF)",
    "Necessidade de Capital de Giro (NCG)",
    "Capital Circulante Líquido (CCL)",
    "Receitas Líquidas",
    "Receitas Brutas",
    "Custos",
    "Despesas",
    "Custos e Despesas",
    "Margem de Contribuição",
    "Deduções das Receitas",
     "Outras Receitas Operacionais",
     "Tributos",
     "Folha e Encargos",
     "Resultado Líquido",
     "Resultado Líquido Acumulado",
    "ROE – Return on Equity (Retorno sobre o Patrimônio Líquido)",
    "ROA – Return on Assets (Retorno sobre Ativos)",
    "EBITDA – Earnings Before Interest, Taxes, Depreciation and Amortization",
    "Peso dos Custos sobre a Receita",
    "Peso das Despesas sobre a Receita",
    "Peso dos Tributos sobre a Receita",
    "Peso da Folha sobre a Receita"
  ]

  // Categorias para agrupamento da tabela
  const categorias: { titulo: string; itens: string[] }[] = [
    {
      titulo: 'Indicadores de Liquidez',
      itens: [
        'Liquidez Corrente',
        'Liquidez Seca',
        'Liquidez Geral',
        'Capital Circulante Líquido (CCL)'
      ],
    },
    {
      titulo: 'Indicadores de Estrutura de Capital / Endividamento',
      itens: [
        'Participação de Capitais de Terceiros (PCT)',
        'Composição do Endividamento (CE)',
        'Imobilização do Patrimônio Líquido (IPL)'
      ],
    },
    {
      titulo: 'Indicadores de Rentabilidade / Lucratividade',
      itens: [
        'Margem Bruta (%)',
        'Margem Líquida (%)',
        'Margem Líquida Acumulada (%)'
      ],
    },
    {
      titulo: 'Indicadores de Atividade / Eficiência',
      itens: [
        'Giro do Ativo',
        'Prazo Médio de Pagamento (PMP)',
        'Prazo Médio de Estocagem (PME)',
        'Prazo Médio de Recebimento (PMR)',
        'Ciclo Operacional (CO)',
        'Ciclo Financeiro (CF)',
        'Necessidade de Capital de Giro (NCG)'
      ],
    },
    {
      titulo: 'Resultado',
      itens: [
        'Receitas Líquidas',
        'Receitas Brutas',
        'Custos',
        'Despesas',
        'Custos e Despesas',
        'Margem de Contribuição',
        'Deduções das Receitas',
        'Outras Receitas Operacionais',
        'Tributos',
        'Folha e Encargos',
        'Resultado Líquido',
        'Resultado Líquido Acumulado'
      ],
    },
    {
      titulo: 'Avaliação',
      itens: [
        'ROE – Return on Equity (Retorno sobre o Patrimônio Líquido)',
        'ROA – Return on Assets (Retorno sobre Ativos)',
        'EBITDA – Earnings Before Interest, Taxes, Depreciation and Amortization'
      ],
    },
    {
      titulo: 'PESOS',
      itens: [
        'Peso dos Custos sobre a Receita',
        'Peso das Despesas sobre a Receita',
        'Peso dos Tributos sobre a Receita',
        'Peso da Folha sobre a Receita'
      ],
    },
  ]

  const descricaoIndicadores: { [key: string]: string } = {
    "Liquidez Corrente": "Mede a capacidade da empresa pagar suas obrigações de curto prazo utilizando todos os ativos de curto prazo disponíveis. Um índice saudável indica maior segurança financeira para honrar compromissos imediatos.",
    "Liquidez Seca": "Avalia a capacidade de pagamento das dívidas de curto prazo sem depender da venda de estoques, o que fornece uma visão mais conservadora da liquidez.",
    "Liquidez Geral": "Analisa a capacidade da empresa quitar todas as suas obrigações, de curto e longo prazo, utilizando seus ativos realizáveis em qualquer prazo.",
    "Participação de Capitais de Terceiros (PCT)": "Mostra o grau de dependência de capital de terceiros em relação ao patrimônio líquido. Índices altos indicam maior alavancagem financeira e potencial aumento de risco.",
    "Composição do Endividamento (CE)": "Indica a proporção das dívidas de curto prazo sobre o total do endividamento. Percentuais mais altos sinalizam maior pressão sobre o caixa no curto prazo.",
    "Imobilização do Patrimônio Líquido (IPL)": "Avalia quanto do patrimônio líquido está aplicado em ativos imobilizados, como máquinas, equipamentos e imóveis, reduzindo a disponibilidade para capital de giro.",
    "Margem Bruta (%)": "Representa o percentual que sobra da receita líquida após a dedução dos custos diretos de produção ou prestação de serviços. Mede a eficiência produtiva da empresa.",
    "Margem Líquida (%)": "Indica o percentual do lucro líquido obtido sobre a receita líquida, refletindo a lucratividade final após todos os custos, despesas e tributos.",
    "Margem Líquida Acumulada (%)": "Representa o percentual de margem líquida com base nos saldos acumulados das contas de receitas, custos e despesas operacionais. Diferentemente da margem líquida mensal (que usa movimento), este indicador considera os valores totais acumulados no saldo atual das contas.",
    "Giro do Ativo": "Mede a eficiência da empresa em gerar receita com o uso de seus ativos. Quanto maior, mais eficiente é a utilização dos recursos. Este número representa quantas vezes o ativo gira em um ano.",
    "Prazo Médio de Pagamento (PMP)": "Mede o tempo médio, em dias, que a empresa leva para pagar seus fornecedores, ajustado proporcionalmente ao mês de referência. Um prazo maior pode indicar melhor negociação, mas também pode afetar o relacionamento com fornecedores.",
    "Prazo Médio de Estocagem (PME)": "Indica o tempo médio, em dias, que os produtos permanecem em estoque antes de serem vendidos, ajustado proporcionalmente ao mês de referência. Prazos longos podem representar capital parado e risco de obsolescência.",
    "Prazo Médio de Recebimento (PMR)": "Mede o tempo médio, em dias, que a empresa leva para receber de seus clientes, ajustado proporcionalmente ao mês de referência. Prazos menores ajudam a melhorar o fluxo de caixa.",
    "Ciclo Operacional (CO)": "Representa o tempo total, em dias, desde a compra de mercadorias ou matérias-primas até o recebimento das vendas. Indica a duração do processo operacional.",
    "Ciclo Financeiro (CF)": "Mede o período, em dias, que a empresa financia suas operações com recursos próprios. Quanto menor, melhor para a liquidez da empresa.",
    "Necessidade de Capital de Giro (NCG)": "Indica o montante de recursos que a empresa precisa manter investido para sustentar suas operações no curto prazo. Valores altos exigem mais capital próprio ou financiamentos.",
    "Capital Circulante Líquido (CCL)": "Representa a diferença entre o ativo circulante e o passivo circulante, mostrando o volume de recursos disponíveis para financiar as operações no curto prazo",
    "Receitas Líquidas": "Valor da receita líquida auferida no mês. Receita já deduzida dos tributos incidentes sobre a venda.",
    "Receitas Brutas": "Valor da receita bruta auferida no mês.",
    "Custos": "Valor do custo do mês.",
    "Despesas": "Valor da despesa do mês.",
    "Custos e Despesas": "Valor do Custo e da Despesa do mês.",
    "Margem de Contribuição": "Valor da Receita líquida deduzida dos custos. A margem de contribuição está relacionada com o quanto cada produto ou serviço oferecido contribui para pagar as despesas fixas de uma empresa.",
    "Deduções das Receitas": "Valor das deduções das receitas no período, conforme conta padrão '3.1.2 - DEDUÇÕES DA RECEITA'.",
    "Outras Receitas Operacionais": "Valor das receitas financeiras no período, conforme conta padrão '3.1.3 - RECEITA FINANCEIRA'.",
    "Tributos": "Soma dos valores de impostos e tributos pagos no período, incluindo IRPJ, CSLL, ISS, Simples Nacional, PIS, COFINS e ICMS.",
    "Folha e Encargos": "Soma dos custos com pessoal (salários) e encargos sociais (FGTS, INSS, etc.), representando o custo total da folha de pagamento da empresa.",
    "Resultado Líquido": "É o lucro ou prejuízo líquido do período. Se for positivo, significa que a empresa teve mais receitas do que gastos. Se for negativo, significa que a empresa teve mais gastos do que receitas.",
    "Resultado Líquido Acumulado": "Representa o resultado líquido acumulado considerando os saldos atuais das contas de receitas, custos e despesas. Calculado através da fórmula: 3 RECEITAS - 4 CUSTOS E DESPESAS, utilizando os valores acumulados até a data de referência.",
    "ROE – Return on Equity (Retorno sobre o Patrimônio Líquido)": "Mede o retorno obtido para cada unidade monetária investida pelos sócios. Indica a rentabilidade do capital próprio da empresa. Quanto maior, melhor para os acionistas.",
    "ROA – Return on Assets (Retorno sobre Ativos)": "Avalia a capacidade da empresa de gerar lucro em relação ao total de ativos que possui. Quanto maior o índice, mais eficiente é a utilização dos recursos disponíveis.",
    "EBITDA – Earnings Before Interest, Taxes, Depreciation and Amortization": "Indica o lucro operacional antes do impacto de juros, tributos, depreciação e amortização. É utilizado para avaliar a geração de caixa operacional da empresa, desconsiderando efeitos financeiros e contábeis.",
    "Peso dos Custos sobre a Receita": "Indica o percentual que os custos representam em relação à receita bruta da empresa. Este indicador ajuda a avaliar a eficiência operacional e o controle de custos diretos.",
    "Peso das Despesas sobre a Receita": "Mostra o percentual que as despesas operacionais representam sobre a receita bruta. Importante para análise da estrutura de gastos administrativos e operacionais.",
    "Peso dos Tributos sobre a Receita": "Representa o percentual da carga tributária total (IRPJ, CSLL, ISS, Simples Nacional, PIS, COFINS, ICMS) sobre a receita bruta. Fundamental para análise da eficiência tributária.",
    "Peso da Folha sobre a Receita": "Indica o percentual que os gastos com pessoal (salários e encargos sociais) representam sobre a receita bruta. Importante indicador de produtividade e controle de custos com pessoal."
  }
  // Fonte por coluna para variáveis de cada indicador
  type FonteColuna = 'saldo_atual' | 'saldo_anterior' | 'movimento'

  // Meta para visual (badge) conforme a fonte escolhida
  const fonteMeta: Record<FonteColuna, { label: string; variant: 'success' | 'info' | 'warning' }> = {
    saldo_atual: { label: 'Saldo Atual', variant: 'success' },
    saldo_anterior: { label: 'Saldo Anterior', variant: 'info' },
    movimento: { label: 'Movimento', variant: 'warning' }
  }

  // Configuração interna por indicador e por variável (padrão: saldo_atual)
  const indicadorVariavelFonteConfig: Record<string, Record<string, FonteColuna>> = {
    'Liquidez Corrente': {
      'Ativo Circulante': 'saldo_atual',
      'Passivo Circulante': 'saldo_atual',
    },
    'Liquidez Seca': {
      'Ativo Circulante': 'saldo_atual',
      'Estoques': 'saldo_atual',
      'Passivo Circulante': 'saldo_atual',
    },
    'Liquidez Geral': {
      'Ativo Circulante': 'saldo_atual',
      'Realizável a Longo Prazo': 'saldo_atual',
      'Passivo Circulante': 'saldo_atual',
      'Exigível a Longo Prazo': 'saldo_atual',
    },
    'Participação de Capitais de Terceiros (PCT)': {
      'Passivo Circulante': 'saldo_atual',
      'Passivo Não Circulante': 'saldo_atual',
      'Patrimônio Líquido': 'saldo_atual',
    },
    'Composição do Endividamento (CE)': {
      'Passivo Circulante': 'saldo_atual',
      'Passivo Não Circulante': 'saldo_atual',
    },
    'Imobilização do Patrimônio Líquido (IPL)': {
      'Imobilizado': 'saldo_atual',
      'Depreciação Acumulada': 'saldo_atual',
      'Patrimônio Líquido': 'saldo_atual',
    },
    'Margem Bruta (%)': {
      'Receitas': 'movimento',
      'Custos': 'movimento',
    },
    'Margem Líquida (%)': {
      'Receitas': 'movimento',
      'Custos': 'movimento',
      'Despesas': 'movimento',
    },
    'Margem Líquida Acumulada (%)': {
      '3 RECEITAS': 'saldo_atual',
      '4.1 CUSTOS': 'saldo_atual', 
      '4.2 DESPESAS OPERACIONAIS': 'saldo_atual',
    },
    'Giro do Ativo': {
      'Receitas': 'movimento',
      'Ativo Circulante': 'saldo_atual',
      'Ativo Não Circulante': 'saldo_atual',
    },
    'Prazo Médio de Pagamento (PMP)': {
      '2.1.1 FORNECEDORES': 'saldo_atual',
      '4.1 CUSTOS': 'saldo_atual',
      '4.1.2 CUSTOS COM PESSOAL': 'saldo_atual',
      '4.1.3 CUSTOS COM ENCARGOS SOCIAIS': 'saldo_atual',
    },
    'Prazo Médio de Estocagem (PME)': {
      '1.1.4 ESTOQUES': 'saldo_atual',
      '4.1 CUSTOS': 'movimento',
      '4.1.2 CUSTOS COM PESSOAL': 'movimento',
      '4.1.3 CUSTOS COM ENCARGOS SOCIAIS': 'movimento',
    },
    'Prazo Médio de Recebimento (PMR)': {
      '1.1.2.1 CLIENTES': 'saldo_atual',
      '3.1.1 RECEITA BRUTA': 'movimento',
    },
    'Ciclo Operacional (CO)': {
      'PME': 'movimento',
      'PMR': 'movimento',
    },
    'Ciclo Financeiro (CF)': {
      'CO': 'movimento',
      'PMP': 'movimento',
    },
    'Necessidade de Capital de Giro (NCG)': {
      '1.1 ATIVO CIRCULANTE': 'saldo_atual',
      '2.1 PASSIVO CIRCULANTE': 'saldo_atual',
    },
    'Capital Circulante Líquido (CCL)': {
      'Ativo Circulante': 'saldo_atual',
      'Passivo Circulante': 'saldo_atual',
    },
    'Receitas Líquidas': {
      '3 RECEITAS': 'movimento',
    },
    'Receitas Brutas': {
      '3.1.1 RECEITA BRUTA': 'movimento',
    },
    'Custos': {
      '4.1 CUSTOS': 'movimento',
    },
    'Despesas': {
      '4.2 DESPESAS OPERACIONAIS': 'movimento',
    },
    'Custos e Despesas': {
      '4 CUSTOS E DESPESAS': 'movimento',
    },
    'Margem de Contribuição': {
      '3 RECEITAS': 'movimento',
      '4.1 CUSTOS': 'movimento',
    },
    'Deduções das Receitas': {
      '3.1.2 - DEDUÇÕES DA RECEITA': 'movimento',
    },
    'Outras Receitas Operacionais': {
      '3.1.3 - RECEITA FINANCEIRA': 'movimento',
    },
    'Resultado Líquido': {
      '3 RECEITAS': 'movimento',
      '4 CUSTOS E DESPESAS': 'movimento',
    },
    'Peso dos Custos sobre a Receita': {
      '4.1 CUSTOS': 'movimento',
      '3.1.1 RECEITA BRUTA': 'movimento',
    },
    'Peso das Despesas sobre a Receita': {
      '4.2 DESPESAS OPERACIONAIS': 'movimento',
      '3.1.1 RECEITA BRUTA': 'movimento',
    },
    'Peso dos Tributos sobre a Receita': {
      '4.2.3 DESPESAS TRIBUTÁRIAS': 'movimento',
      '3.1.2.1 ISS': 'movimento',
      '3.1.2.2 SIMPLES NACIONAL': 'movimento',
      '3.1.2.3 PIS': 'movimento',
      '3.1.2.4 COFINS': 'movimento',
      '3.1.2.5 ICMS': 'movimento',
      '3.1.1 RECEITA BRUTA': 'movimento',
    },
    'Peso da Folha sobre a Receita': {
      '4.1.2 CUSTOS COM PESSOAL': 'movimento',
      '4.1.3 CUSTOS COM ENCARGOS SOCIAIS': 'movimento',
      '3.1.1 RECEITA BRUTA': 'movimento',
    },
    'Tributos': {
      '4.2.3 DESPESAS TRIBUTÁRIAS': 'movimento',
      '3.1.2.1 ISS': 'movimento',
      '3.1.2.2 SIMPLES NACIONAL': 'movimento',
      '3.1.2.3 PIS': 'movimento',
      '3.1.2.4 COFINS': 'movimento',
      '3.1.2.5 ICMS': 'movimento',
    },
    'Folha e Encargos': {
      '4.1.2 CUSTOS COM PESSOAL': 'movimento',
      '4.1.3 CUSTOS COM ENCARGOS SOCIAIS': 'movimento',
    },
    'Resultado Líquido Acumulado': {
      '3 RECEITAS': 'saldo_atual',
      '4 CUSTOS E DESPESAS': 'saldo_atual',
    },
  }

  const getVarFonte = (indicador: string, variavel: string): FonteColuna =>
    indicadorVariavelFonteConfig[indicador]?.[variavel] ?? 'saldo_atual'

  // Carregar empresas disponíveis
  useEffect(() => {
    carregarEmpresas()
  }, [])

  // Carregar anos disponíveis quando empresa for selecionada
  useEffect(() => {
    if (empresaSelecionada) {
      carregarAnosDisponiveis()
    }
  }, [empresaSelecionada])

  const carregarEmpresas = async () => {
    try {
      // Primeiro, buscar CNPJs únicos que têm balancetes
      const { data: balancetesData, error: balancetesError } = await supabase
        .from('balancetes')
        .select('cnpj')

      if (balancetesError) throw balancetesError

      const cnpjsComBalancetes = [...new Set(balancetesData?.map(b => b.cnpj) || [])]

      if (cnpjsComBalancetes.length === 0) {
        setEmpresas([])
        return
      }

      // Depois, buscar dados das empresas que têm esses CNPJs
      const { data: empresasData, error: empresasError } = await supabase
        .from('clients')
        .select('cnpj, nome_empresarial')
        .in('cnpj', cnpjsComBalancetes)
        .order('nome_empresarial')

      if (empresasError) throw empresasError

      setEmpresas(empresasData || [])
    } catch (error) {
      console.error('Erro ao carregar empresas:', error)
      toast({
        title: "Erro",
        description: "Falha ao carregar lista de empresas",
        variant: "destructive"
      })
    }
  }

  const carregarAnosDisponiveis = async () => {
    try {
      const { data, error } = await supabase
        .from('balancetes')
        .select('ano')
        .eq('cnpj', empresaSelecionada)
        .in('status', ['parametrizado', 'parametrizando'])
        .order('ano', { ascending: false })

      if (error) throw error

      const anos = [...new Set(data?.map(b => b.ano) || [])]
      setAnosDisponiveis(anos)

      // Selecionar o ano mais recente por padrão
      if (anos.length > 0 && !anoSelecionado) {
        setAnoSelecionado(anos[0].toString())
      }
    } catch (error) {
      console.error('Erro ao carregar anos:', error)
    }
  }

  const obterValorConta = (dadosBalancete: BalanceteData[], grupo: string): number => {
    let total = 0
    
    for (const balancete of dadosBalancete) {
      for (const [codigo, valor] of Object.entries(balancete.contas)) {
        // Buscar a conta no plano de contas para verificar o grupo
        if (codigo.startsWith(grupo)) {
          total += valor
        }
      }
    }
    
    return total
  }

  // Função para mapear indicador para categoria
  const obterCategoriaIndicador = (indicador: string): string => {
    for (const categoria of categorias) {
      if (categoria.itens.includes(indicador)) {
        return categoria.titulo
      }
    }
    return "Outros" // fallback
  }

  // Função para buscar indicadores salvos no banco de dados
  const buscarIndicadores = async () => {
    if (!empresaSelecionada || !anoSelecionado) {
      toast({
        title: "Filtros obrigatórios",
        description: "Selecione empresa e ano para buscar os indicadores",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const { data: indicadoresSalvos, error } = await supabase
        .from('indicadores_calculados')
        .select('*')
        .eq('empresa_cnpj', empresaSelecionada)
        .eq('ano', parseInt(anoSelecionado))
        .order('mes')

      if (error) throw error

      if (!indicadoresSalvos || indicadoresSalvos.length === 0) {
        toast({
          title: "Nenhum indicador encontrado",
          description: "Não há indicadores salvos para os filtros selecionados. Use 'Recalcular e Salvar' primeiro.",
          variant: "destructive"
        })
        setIndicadores({})
        setMesesExibidos([])
        return
      }

      // Processar dados salvos
      const resultadosIndicadores: { [nome: string]: IndicadorData } = {}
      const mesesSet = new Set<number>()

      // Inicializar estrutura de indicadores
      nomeIndicadores.forEach(nomeIndicador => {
        resultadosIndicadores[nomeIndicador] = {}
      })

      // Preencher com dados salvos
      indicadoresSalvos.forEach(item => {
        mesesSet.add(item.mes)
        if (resultadosIndicadores[item.nome_indicador]) {
          const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
          const mesNome = nomesMeses[item.mes - 1]
          resultadosIndicadores[item.nome_indicador][mesNome] = parseFloat(item.valor.toString())
        }
      })

      // Criar lista de meses exibidos
      const mesesOrdenados = Array.from(mesesSet).sort((a, b) => a - b)
      const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      setMesesExibidos(mesesOrdenados.map(m => nomesMeses[m - 1]))

      setIndicadores(resultadosIndicadores)
      setDadosDetalhados({}) // Limpar dados detalhados pois vêm do banco

      toast({
        title: "Indicadores carregados",
        description: `${indicadoresSalvos.length} indicadores encontrados no banco de dados`,
        variant: "default"
      })

    } catch (error) {
      console.error("Erro ao buscar indicadores:", error)
      toast({
        title: "Erro ao buscar indicadores",
        description: "Não foi possível carregar os indicadores do banco de dados",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Função para verificar contas necessárias antes do cálculo
  const verificarContasNecessarias = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const { data: parametrizacoes, error } = await supabase
        .from('parametrizacoes')
        .select(`
          conta_balancete_codigo,
          plano_contas (
            codigo, nome
          )
        `)
        .eq('empresa_cnpj', empresaSelecionada)

      if (error) throw error

      const contasParametrizadas = parametrizacoes?.map(p => p.plano_contas?.codigo).filter(Boolean) || []
      
      // Verificar contas específicas dos novos indicadores
      const contasNecessarias = [
        { codigo: '3.1.2', nome: 'DEDUÇÕES DA RECEITA', indicador: 'Deduções das Receitas' },
        { codigo: '3.1.3', nome: 'RECEITA FINANCEIRA', indicador: 'Outras Receitas Operacionais' }
      ]

      const contasFaltando = contasNecessarias.filter(conta => 
        !contasParametrizadas.some(param => param.startsWith(conta.codigo))
      )

      if (contasFaltando.length > 0) {
        const message = `Contas não parametrizadas encontradas: ${contasFaltando.map(c => `${c.codigo} (${c.indicador})`).join(', ')}`
        console.warn(`[VERIFICAÇÃO] ${message}`)
        return { success: false, message }
      }

      console.log(`[VERIFICAÇÃO] ✅ Todas as contas necessárias para os novos indicadores estão parametrizadas`)
      return { success: true, message: 'Todas as contas necessárias estão parametrizadas' }

    } catch (error) {
      console.error('Erro na verificação de contas:', error)
      return { success: false, message: 'Erro ao verificar contas parametrizadas' }
    }
  }

  // Função para verificar se os indicadores foram salvos corretamente
  const verificarIndicadoresSalvos = async (indicadoresEsperados: string[]): Promise<boolean> => {
    try {
      const { data: indicadoresSalvos, error } = await supabase
        .from('indicadores_calculados')
        .select('nome_indicador')
        .eq('empresa_cnpj', empresaSelecionada)
        .eq('ano', parseInt(anoSelecionado))
        .in('nome_indicador', indicadoresEsperados)

      if (error) throw error

      const nomesSalvos = indicadoresSalvos?.map(i => i.nome_indicador) || []
      const indicadoresEncontrados = indicadoresEsperados.filter(nome => nomesSalvos.includes(nome))
      
      console.log(`[VERIFICAÇÃO SALVAMENTO] Indicadores esperados: ${indicadoresEsperados.join(', ')}`)
      console.log(`[VERIFICAÇÃO SALVAMENTO] Indicadores encontrados no BD: ${indicadoresEncontrados.join(', ')}`)
      
      return indicadoresEncontrados.length === indicadoresEsperados.length

    } catch (error) {
      console.error('Erro na verificação de salvamento:', error)
      return false
    }
  }

  // Função para recalcular e salvar indicadores no banco de dados
  const recalcularESalvar = async () => {
    if (!empresaSelecionada || !anoSelecionado) {
      toast({
        title: "Filtros obrigatórios",
        description: "Selecione empresa e ano para recalcular os indicadores",
        variant: "destructive"
      })
      return
    }

    setLoadingSave(true)

    try {
      // Verificar contas necessárias antes do cálculo
      const verificacao = await verificarContasNecessarias()
      if (!verificacao.success) {
        console.warn(`[AVISO] ${verificacao.message}`)
        toast({
          title: "Aviso sobre parametrização",
          description: verificacao.message,
          variant: "default"
        })
      }

      // Primeiro, calcular os indicadores (reutilizar lógica existente)
      console.log(`[CÁLCULO] Iniciando cálculo de indicadores para ${empresaSelecionada} - ${anoSelecionado}`)
      const { resultadosIndicadores } = await calcularIndicadoresInterno()

      // Verificar se os novos indicadores foram calculados
      const novosIndicadores = ['Deduções das Receitas', 'Outras Receitas Operacionais']
      const novosIndicadoresCalculados = novosIndicadores.filter(nome => {
        const dados = resultadosIndicadores[nome]
        return dados && Object.values(dados).some(valor => valor !== null && valor !== undefined)
      })

      console.log(`[NOVOS INDICADORES] Calculados com sucesso: ${novosIndicadoresCalculados.join(', ')}`)
      if (novosIndicadoresCalculados.length < novosIndicadores.length) {
        const naoCalculados = novosIndicadores.filter(nome => !novosIndicadoresCalculados.includes(nome))
        console.warn(`[NOVOS INDICADORES] Não calculados: ${naoCalculados.join(', ')}`)
      }

      // Depois, salvar no banco de dados
      const indicadoresParaSalvar: any[] = []

      Object.entries(resultadosIndicadores).forEach(([nomeIndicador, dadosMeses]) => {
        Object.entries(dadosMeses).forEach(([mesNome, valor]) => {
          if (valor !== null && valor !== undefined) {
            const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
            const mes = nomesMeses.indexOf(mesNome) + 1
            
            indicadoresParaSalvar.push({
              empresa_cnpj: empresaSelecionada,
              ano: parseInt(anoSelecionado),
              mes: mes,
              categoria: obterCategoriaIndicador(nomeIndicador),
              nome_indicador: nomeIndicador,
              valor: valor
            })
          }
        })
      })

      if (indicadoresParaSalvar.length === 0) {
        toast({
          title: "Nenhum indicador para salvar",
          description: "Não há indicadores calculados para salvar",
          variant: "destructive"
        })
        return
      }

      // Log dos novos indicadores que serão salvos
      const novosIndicadoresParaSalvar = indicadoresParaSalvar.filter(i => novosIndicadores.includes(i.nome_indicador))
      console.log(`[SALVAMENTO] Novos indicadores a serem salvos: ${novosIndicadoresParaSalvar.length} registros`)
      novosIndicadoresParaSalvar.forEach(ind => {
        console.log(`  - ${ind.nome_indicador} - Mês ${ind.mes}: ${ind.valor}`)
      })

      // Remover indicadores existentes para a mesma empresa/ano (para substituir)
      const { error: deleteError } = await supabase
        .from('indicadores_calculados')
        .delete()
        .eq('empresa_cnpj', empresaSelecionada)
        .eq('ano', parseInt(anoSelecionado))

      if (deleteError) throw deleteError

      // Inserir novos indicadores
      const { error: insertError } = await supabase
        .from('indicadores_calculados')
        .insert(indicadoresParaSalvar)

      if (insertError) throw insertError

      console.log(`[SALVAMENTO] ✅ ${indicadoresParaSalvar.length} indicadores salvos com sucesso`)

      // Verificar se os novos indicadores foram salvos corretamente
      if (novosIndicadoresCalculados.length > 0) {
        const salvamentoVerificado = await verificarIndicadoresSalvos(novosIndicadoresCalculados)
        if (salvamentoVerificado) {
          console.log(`[VERIFICAÇÃO FINAL] ✅ Novos indicadores confirmados no banco de dados`)
        } else {
          console.warn(`[VERIFICAÇÃO FINAL] ⚠️ Alguns novos indicadores podem não ter sido salvos corretamente`)
        }
      }

      toast({
        title: "Indicadores salvos com sucesso",
        description: `${indicadoresParaSalvar.length} indicadores foram salvos no banco de dados${novosIndicadoresCalculados.length > 0 ? `, incluindo ${novosIndicadoresCalculados.length} novos indicadores` : ''}`,
        variant: "default"
      })

    } catch (error) {
      console.error("Erro ao recalcular e salvar indicadores:", error)
      toast({
        title: "Erro ao salvar indicadores",
        description: "Não foi possível salvar os indicadores no banco de dados",
        variant: "destructive"
      })
    } finally {
      setLoadingSave(false)
    }
  }

  const calcularIndicadoresInterno = async () => {

    try {
      // Buscar balancetes da empresa no ano selecionado (incluindo parametrizando)
      const { data: balancetes, error: balancetesError } = await supabase
        .from('balancetes')
        .select(`
          id, ano, mes,
          contas_balancete (
            codigo, nome, saldo_atual, saldo_anterior
          )
        `)
        .eq('cnpj', empresaSelecionada)
        .eq('ano', parseInt(anoSelecionado))
        .in('status', ['parametrizado', 'parametrizando'])
        .order('mes')

      if (balancetesError) throw balancetesError

      if (!balancetes || balancetes.length === 0) {
        throw new Error("Nenhum balancete encontrado para os filtros selecionados")
      }

      // Buscar parametrizações para mapear contas do balancete para plano de contas
      const { data: parametrizacoes, error: paramError } = await supabase
        .from('parametrizacoes')
        .select(`
          conta_balancete_codigo,
          plano_contas (
            codigo, nome, grupo, tipo
          )
        `)
        .eq('empresa_cnpj', empresaSelecionada)

      if (paramError) throw paramError

      // Criar mapa de parametrizações
      const mapaParametrizacoes = new Map()
      parametrizacoes?.forEach(p => {
        if (p.plano_contas) {
          mapaParametrizacoes.set(p.conta_balancete_codigo, p.plano_contas)
        }
      })

      // Processar dados por mês usando APENAS contas parametrizadas do Plano de Contas Padrão
      const dadosPorMes: { [mes: number]: { [codigoPlano: string]: { saldo_atual: number; saldo_anterior: number } } } = {}
      const mesesComDados: number[] = []

      balancetes.forEach(balancete => {
        if (!dadosPorMes[balancete.mes]) {
          dadosPorMes[balancete.mes] = {}
          mesesComDados.push(balancete.mes)
        }

        balancete.contas_balancete?.forEach(conta => {
          const planoContas = mapaParametrizacoes.get(conta.codigo)
          // CRÍTICO: Só processar contas que estão parametrizadas no Plano de Contas Padrão
          if (planoContas) {
            const codigoPlano = planoContas.codigo
            if (!dadosPorMes[balancete.mes][codigoPlano]) {
              dadosPorMes[balancete.mes][codigoPlano] = { saldo_atual: 0, saldo_anterior: 0 }
            }
            dadosPorMes[balancete.mes][codigoPlano].saldo_atual += parseFloat(conta.saldo_atual?.toString() || "0")
            dadosPorMes[balancete.mes][codigoPlano].saldo_anterior += parseFloat(conta.saldo_anterior?.toString() || "0")
          }
        })
      })

      // Criar lista de meses exibidos
      const mesesOrdenados = mesesComDados.sort((a, b) => a - b)
      const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      setMesesExibidos(mesesOrdenados.map(m => nomesMeses[m - 1]))

      // Calcular indicadores para cada mês
      const resultadosIndicadores: { [nome: string]: IndicadorData } = {}

      nomeIndicadores.forEach(nomeIndicador => {
        resultadosIndicadores[nomeIndicador] = {}
      })

      mesesOrdenados.forEach(mes => {
        const mesNome = nomesMeses[mes - 1]
        const dados = dadosPorMes[mes]

        // Funções para obter valores por campo/fonte (saldo_atual, saldo_anterior, movimento)
        const obterValorContaCampo = (codigo: string, campo: 'saldo_atual' | 'saldo_anterior'): number => {
          if (dados[codigo]?.[campo] !== undefined) {
            return dados[codigo][campo]
          }
          let total = 0
          const proximoNivel = codigo + '.'
          for (const [codigoConta, valores] of Object.entries(dados)) {
            if (codigoConta.startsWith(proximoNivel)) {
              const parteFilha = codigoConta.substring(proximoNivel.length)
              if (!parteFilha.includes('.')) {
                const v = valores as { saldo_atual: number; saldo_anterior: number }
                total += v[campo] || 0
              }
            }
          }
          return total
        }

        const obterValorConta = (codigo: string): number => obterValorContaCampo(codigo, 'saldo_atual')

        // Fonte explícita por indicador
        const obterValorContaPorFonte = (codigo: string, fonte: FonteColuna): number => {
          switch (fonte) {
            case 'saldo_anterior':
              return obterValorContaCampo(codigo, 'saldo_anterior')
            case 'movimento':
              return obterValorContaCampo(codigo, 'saldo_atual') - obterValorContaCampo(codigo, 'saldo_anterior')
            case 'saldo_atual':
            default:
              return obterValorContaCampo(codigo, 'saldo_atual')
          }
        }

        // Debug: Log das contas disponíveis para este mês
        console.log(`=== MÊS ${mes} ===`)
        console.log('Contas parametrizadas disponíveis:', Object.keys(dados))
        console.log('Valores das contas:', dados)

        // Obter valores usando APENAS contas parametrizadas do Plano de Contas Padrão (sem dupla contagem)
        const ativoCirculante = obterValorConta('1.1')  // 1.1 - Ativo Circulante
        const ativoNaoCirculante = obterValorConta('1.2')  // 1.2 - Ativo Não Circulante
        const ativoTotal = ativoCirculante + ativoNaoCirculante
        const passivoCirculante = obterValorConta('2.1')  // 2.1 - Passivo Circulante
        const passivoNaoCirculante = obterValorConta('2.2')  // 2.2 - Passivo Não Circulante
        const passivoTotal = passivoCirculante + passivoNaoCirculante
        const patrimonioLiquido = obterValorConta('2.3')  // 2.3 - Patrimônio Líquido
        const estoques = obterValorConta('1.1.4')  // 1.1.4 - Estoques
        const realizavelLongoPrazo = obterValorConta('1.2.1')  // 1.2.1 - Realizável a Longo Prazo
        const imobilizado = obterValorConta('1.2.3')  // 1.2.3 - Imobilizado
        const depreciacaoAcumulada = obterValorConta('1.2.4')  // 1.2.4 - ( - ) Depreciação Acumulada
        const receitas = obterValorConta('3.1')  // 3.1 - Receitas
        const custos = obterValorConta('3.2')  // 3.2 - Custos (não utilizado na Margem Bruta)
        const despesas = obterValorConta('4.')  // 4. - Despesas (geral - não utilizado na Margem Líquida)
        const custosPlano41 = obterValorConta('4.1')  // 4.1 - CUSTOS (Plano Padrão)
        const despesasPlano42 = obterValorConta('4.2')  // 4.2 - DESPESAS OPERACIONAIS (Plano Padrão)

        // Debug: Log dos valores calculados CORRIGIDOS
        console.log('VALORES CALCULADOS CORRIGIDOS:')
        console.log('Ativo Circulante (1.1):', ativoCirculante)
        console.log('Ativo Não Circulante (1.2):', ativoNaoCirculante)
        console.log('Ativo Total:', ativoTotal)
        console.log('Passivo Circulante (2.1):', passivoCirculante)
        console.log('Passivo Não Circulante (2.2):', passivoNaoCirculante)
        console.log('Passivo Total:', passivoTotal)
        console.log('Patrimônio Líquido (2.3):', patrimonioLiquido)
        
        // Debug específico para estoques
        console.log('=== DEBUG ESTOQUES ===')
        console.log('Conta 1.1.4 existe diretamente?', dados['1.1.4'] !== undefined)
        if (dados['1.1.4'] !== undefined) {
          console.log('Valor direto de 1.1.4:', dados['1.1.4'])
        }
        console.log('Contas filhas de 1.1.4:')
        Object.keys(dados).filter(codigo => codigo.startsWith('1.1.4.')).forEach(codigo => {
          const parteFilha = codigo.substring('1.1.4.'.length)
          const ehFilhaDireta = !parteFilha.includes('.')
          console.log(`  ${codigo}: ${dados[codigo]} (filha direta: ${ehFilhaDireta})`)
        })
        console.log('Valor calculado de estoques:', estoques)
        
        console.log('Realizável a Longo Prazo (1.2.1):', realizavelLongoPrazo)

        // Função para verificar se existem contas parametrizadas para um grupo
        const temContasParametrizadas = (prefixo: string): boolean => {
          return Object.keys(dados).some(codigo => codigo.startsWith(prefixo))
        }

        // Calcular indicadores APENAS se todas as contas necessárias estão parametrizadas
        // Liquidez Corrente: precisa de Ativo Circulante e Passivo Circulante parametrizados
        {
          if (temContasParametrizadas('1.1') && temContasParametrizadas('2.1')) {
            const ac = obterValorContaPorFonte('1.1', getVarFonte("Liquidez Corrente", 'Ativo Circulante'))
            const pc = obterValorContaPorFonte('2.1', getVarFonte("Liquidez Corrente", 'Passivo Circulante'))
            resultadosIndicadores["Liquidez Corrente"][mesNome] = pc !== 0 ? ac / pc : null
          } else {
            resultadosIndicadores["Liquidez Corrente"][mesNome] = null
          }
        }

        // Liquidez Seca: precisa de Ativo Circulante e Passivo Circulante parametrizados
        {
          if (temContasParametrizadas('1.1') && temContasParametrizadas('2.1')) {
            const ac = obterValorContaPorFonte('1.1', getVarFonte("Liquidez Seca", 'Ativo Circulante'))
            const est = obterValorContaPorFonte('1.1.4', getVarFonte("Liquidez Seca", 'Estoques'))
            const pc = obterValorContaPorFonte('2.1', getVarFonte("Liquidez Seca", 'Passivo Circulante'))
            resultadosIndicadores["Liquidez Seca"][mesNome] = pc !== 0 ? (ac - est) / pc : null
          } else {
            resultadosIndicadores["Liquidez Seca"][mesNome] = null
          }
        }

        // Liquidez Geral: precisa de Ativo Circulante, Passivo Circulante e Não Circulante
        {
          if (temContasParametrizadas('1.1') && temContasParametrizadas('2.1') && temContasParametrizadas('2.2')) {
            const ac = obterValorContaPorFonte('1.1', getVarFonte("Liquidez Geral", 'Ativo Circulante'))
            const rlp = obterValorContaPorFonte('1.2.1', getVarFonte("Liquidez Geral", 'Realizável a Longo Prazo'))
            const pc = obterValorContaPorFonte('2.1', getVarFonte("Liquidez Geral", 'Passivo Circulante'))
            const pnc = obterValorContaPorFonte('2.2', getVarFonte("Liquidez Geral", 'Exigível a Longo Prazo'))
            const denom = pc + pnc
            resultadosIndicadores["Liquidez Geral"][mesNome] = denom !== 0 ? (ac + rlp) / denom : null
          } else {
            resultadosIndicadores["Liquidez Geral"][mesNome] = null
          }
        }

        // PCT: precisa de Passivo (2.1 e 2.2) e Patrimônio Líquido (2.3) parametrizados
        {
          if (temContasParametrizadas('2.1') && temContasParametrizadas('2.2') && temContasParametrizadas('2.3')) {
            const pc = obterValorContaPorFonte('2.1', getVarFonte("Participação de Capitais de Terceiros (PCT)", 'Passivo Circulante'))
            const pnc = obterValorContaPorFonte('2.2', getVarFonte("Participação de Capitais de Terceiros (PCT)", 'Passivo Não Circulante'))
            const pl = obterValorContaPorFonte('2.3', getVarFonte("Participação de Capitais de Terceiros (PCT)", 'Patrimônio Líquido'))
            resultadosIndicadores["Participação de Capitais de Terceiros (PCT)"][mesNome] = pl !== 0 ? (pc + pnc) / pl : null
          } else {
            resultadosIndicadores["Participação de Capitais de Terceiros (PCT)"][mesNome] = null
          }
        }

        // IPL: precisa de Imobilizado (1.2.3), Depreciação Acumulada (1.2.4) e Patrimônio Líquido (2.3) parametrizados
        {
          if (temContasParametrizadas('1.2.3') && temContasParametrizadas('1.2.4') && temContasParametrizadas('2.3')) {
            const imob = obterValorContaPorFonte('1.2.3', getVarFonte("Imobilização do Patrimônio Líquido (IPL)", 'Imobilizado'))
            const deprec = obterValorContaPorFonte('1.2.4', getVarFonte("Imobilização do Patrimônio Líquido (IPL)", 'Depreciação Acumulada'))
            const pl = obterValorContaPorFonte('2.3', getVarFonte("Imobilização do Patrimônio Líquido (IPL)", 'Patrimônio Líquido'))
            resultadosIndicadores["Imobilização do Patrimônio Líquido (IPL)"][mesNome] = pl !== 0 ? (imob - Math.abs(deprec)) / pl : null
          } else {
            resultadosIndicadores["Imobilização do Patrimônio Líquido (IPL)"][mesNome] = null
          }
        }

        // CE: precisa de Passivo Circulante (2.1) e Passivo Não Circulante (2.2) parametrizados
        {
          if (temContasParametrizadas('2.1') && temContasParametrizadas('2.2')) {
            const pc = obterValorContaPorFonte('2.1', getVarFonte("Composição do Endividamento (CE)", 'Passivo Circulante'))
            const pnc = obterValorContaPorFonte('2.2', getVarFonte("Composição do Endividamento (CE)", 'Passivo Não Circulante'))
            const denom = pc + pnc
            resultadosIndicadores["Composição do Endividamento (CE)"][mesNome] = denom !== 0 ? pc / denom : null
          } else {
            resultadosIndicadores["Composição do Endividamento (CE)"][mesNome] = null
          }
        }

        // Margem Bruta: precisa de Receitas (3) e Custos (4.1) parametrizados
        {
          if (temContasParametrizadas('3') && temContasParametrizadas('4.1')) {
            const rec = obterValorContaPorFonte('3', getVarFonte("Margem Bruta (%)", 'Receitas'))
            const custos41 = obterValorContaPorFonte('4.1', getVarFonte("Margem Bruta (%)", 'Custos'))
            const lucroBruto = rec - custos41
            resultadosIndicadores["Margem Bruta (%)"][mesNome] = rec !== 0 ? (lucroBruto / rec) * 100 : null
          } else {
            resultadosIndicadores["Margem Bruta (%)"][mesNome] = null
          }
        }

        // Margem Líquida: precisa de Receitas (3.1), Custos (4.1) e Despesas Operacionais (4.2) parametrizados
        {
          if (temContasParametrizadas('3.1') && temContasParametrizadas('4.1') && temContasParametrizadas('4.2')) {
            const rec = obterValorContaPorFonte('3.1', getVarFonte("Margem Líquida (%)", 'Receitas'))
            const custos41 = obterValorContaPorFonte('4.1', getVarFonte("Margem Líquida (%)", 'Custos'))
            const despesas42 = obterValorContaPorFonte('4.2', getVarFonte("Margem Líquida (%)", 'Despesas'))
            const lucroLiquido = rec - custos41 - despesas42
            resultadosIndicadores["Margem Líquida (%)"][mesNome] = rec !== 0 ? (lucroLiquido / rec) * 100 : null
          } else {
            resultadosIndicadores["Margem Líquida (%)"][mesNome] = null
          }
        }

        // Margem Líquida Acumulada: precisa de Receitas (3), Custos (4.1) e Despesas Operacionais (4.2) parametrizados
        {
          if (temContasParametrizadas('3') && temContasParametrizadas('4.1') && temContasParametrizadas('4.2')) {
            const rec = obterValorContaPorFonte('3', getVarFonte("Margem Líquida Acumulada (%)", '3 RECEITAS'))
            const custos41 = obterValorContaPorFonte('4.1', getVarFonte("Margem Líquida Acumulada (%)", '4.1 CUSTOS'))
            const despesas42 = obterValorContaPorFonte('4.2', getVarFonte("Margem Líquida Acumulada (%)", '4.2 DESPESAS OPERACIONAIS'))
            const lucroLiquidoAcumulado = rec - custos41 - despesas42
            resultadosIndicadores["Margem Líquida Acumulada (%)"][mesNome] = rec !== 0 ? (lucroLiquidoAcumulado / rec) * 100 : null
          } else {
            resultadosIndicadores["Margem Líquida Acumulada (%)"][mesNome] = null
          }
        }

        // Giro do Ativo: precisa de Receitas (3.1) e Ativo Total (1.1 + 1.2) parametrizados
        {
          if (temContasParametrizadas('3.1') && temContasParametrizadas('1.1') && temContasParametrizadas('1.2')) {
            const rec = obterValorContaPorFonte('3.1', getVarFonte("Giro do Ativo", 'Receitas'))
            const ac = obterValorContaPorFonte('1.1', getVarFonte("Giro do Ativo", 'Ativo Circulante'))
            const anc = obterValorContaPorFonte('1.2', getVarFonte("Giro do Ativo", 'Ativo Não Circulante'))
            const at = ac + anc
            resultadosIndicadores["Giro do Ativo"][mesNome] = at !== 0 && rec !== 0 ? (rec / at) * 12 : null
          } else {
            resultadosIndicadores["Giro do Ativo"][mesNome] = null
          }
        }

        // Prazo Médio de Pagamento (PMP)
        {
          if (temContasParametrizadas('2.1.1') && temContasParametrizadas('4.1') && temContasParametrizadas('4.1.2') && temContasParametrizadas('4.1.3')) {
            const fornecedores = obterValorContaPorFonte('2.1.1', getVarFonte("Prazo Médio de Pagamento (PMP)", '2.1.1 FORNECEDORES'))
            const custos = obterValorContaPorFonte('4.1', getVarFonte("Prazo Médio de Pagamento (PMP)", '4.1 CUSTOS'))
            const custosComPessoal = obterValorContaPorFonte('4.1.2', getVarFonte("Prazo Médio de Pagamento (PMP)", '4.1.2 CUSTOS COM PESSOAL'))
            const custosComEncargos = obterValorContaPorFonte('4.1.3', getVarFonte("Prazo Médio de Pagamento (PMP)", '4.1.3 CUSTOS COM ENCARGOS SOCIAIS'))
            const comprasAPrazo = custos - custosComPessoal - custosComEncargos
            const fatorTempo = (360 / 12) * mes
            resultadosIndicadores["Prazo Médio de Pagamento (PMP)"][mesNome] = comprasAPrazo !== 0 ? (fornecedores / comprasAPrazo) * fatorTempo : null
          } else {
            resultadosIndicadores["Prazo Médio de Pagamento (PMP)"][mesNome] = null
          }
        }

        // Prazo Médio de Estocagem (PME)
        {
          if (temContasParametrizadas('1.1.4') && temContasParametrizadas('4.1') && temContasParametrizadas('4.1.2') && temContasParametrizadas('4.1.3')) {
            const estoques = obterValorContaPorFonte('1.1.4', getVarFonte("Prazo Médio de Estocagem (PME)", '1.1.4 ESTOQUES'))
            const custos = obterValorContaPorFonte('4.1', getVarFonte("Prazo Médio de Estocagem (PME)", '4.1 CUSTOS'))
            const custosComPessoal = obterValorContaPorFonte('4.1.2', getVarFonte("Prazo Médio de Estocagem (PME)", '4.1.2 CUSTOS COM PESSOAL'))
            const custosComEncargos = obterValorContaPorFonte('4.1.3', getVarFonte("Prazo Médio de Estocagem (PME)", '4.1.3 CUSTOS COM ENCARGOS SOCIAIS'))
            const custoMercadoriasVendidas = custos - custosComPessoal - custosComEncargos
            const fatorTempo = 360 / (12 * mes)
            resultadosIndicadores["Prazo Médio de Estocagem (PME)"][mesNome] = custoMercadoriasVendidas !== 0 ? (estoques / custoMercadoriasVendidas) * fatorTempo : null
          } else {
            resultadosIndicadores["Prazo Médio de Estocagem (PME)"][mesNome] = null
          }
        }

        // Prazo Médio de Recebimento (PMR)
        {
          if (temContasParametrizadas('1.1.2.1') && temContasParametrizadas('3.1.1')) {
            const clientes = obterValorContaPorFonte('1.1.2.1', getVarFonte("Prazo Médio de Recebimento (PMR)", '1.1.2.1 CLIENTES'))
            const vendasAPrazo = obterValorContaPorFonte('3.1.1', getVarFonte("Prazo Médio de Recebimento (PMR)", '3.1.1 RECEITA BRUTA'))
            const fatorTempo = 360 / (12 * mes)
            resultadosIndicadores["Prazo Médio de Recebimento (PMR)"][mesNome] = vendasAPrazo !== 0 ? (clientes / vendasAPrazo) * fatorTempo : null
          } else {
            resultadosIndicadores["Prazo Médio de Recebimento (PMR)"][mesNome] = null
          }
        }

        // Ciclo Operacional (CO)
        {
          const pme = resultadosIndicadores["Prazo Médio de Estocagem (PME)"][mesNome]
          const pmr = resultadosIndicadores["Prazo Médio de Recebimento (PMR)"][mesNome]
          if (pme !== null && pmr !== null) {
            resultadosIndicadores["Ciclo Operacional (CO)"][mesNome] = pme + pmr
          } else {
            resultadosIndicadores["Ciclo Operacional (CO)"][mesNome] = null
          }
        }

        // Ciclo Financeiro (CF)
        {
          const co = resultadosIndicadores["Ciclo Operacional (CO)"][mesNome]
          const pmp = resultadosIndicadores["Prazo Médio de Pagamento (PMP)"][mesNome]
          if (co !== null && pmp !== null) {
            resultadosIndicadores["Ciclo Financeiro (CF)"][mesNome] = co - pmp
          } else {
            resultadosIndicadores["Ciclo Financeiro (CF)"][mesNome] = null
          }
        }

        // Necessidade de Capital de Giro (NCG)
        {
          if (temContasParametrizadas('1.1') && temContasParametrizadas('2.1')) {
            const ativoCirculanteOp = obterValorContaPorFonte('1.1', getVarFonte("Necessidade de Capital de Giro (NCG)", '1.1 ATIVO CIRCULANTE'))
            const passivoCirculanteOp = obterValorContaPorFonte('2.1', getVarFonte("Necessidade de Capital de Giro (NCG)", '2.1 PASSIVO CIRCULANTE'))
            resultadosIndicadores["Necessidade de Capital de Giro (NCG)"][mesNome] = (ativoCirculanteOp - passivoCirculanteOp) * -1
          } else {
            resultadosIndicadores["Necessidade de Capital de Giro (NCG)"][mesNome] = null
          }
        }

        {
          if (temContasParametrizadas('1.1') && temContasParametrizadas('2.1')) {
            const ac = obterValorContaPorFonte('1.1', getVarFonte("Capital Circulante Líquido (CCL)", 'Ativo Circulante'))
            const pc = obterValorContaPorFonte('2.1', getVarFonte("Capital Circulante Líquido (CCL)", 'Passivo Circulante'))
            resultadosIndicadores["Capital Circulante Líquido (CCL)"][mesNome] = ac - pc
          } else {
            resultadosIndicadores["Capital Circulante Líquido (CCL)"][mesNome] = null
          }
        }

        // Receitas Líquidas
        {
          if (temContasParametrizadas('3')) {
            const receitas = obterValorContaPorFonte('3', getVarFonte("Receitas Líquidas", '3 RECEITAS'))
            resultadosIndicadores["Receitas Líquidas"][mesNome] = receitas
          } else {
            resultadosIndicadores["Receitas Líquidas"][mesNome] = null
          }
        }

        // Receitas Brutas
        {
          if (temContasParametrizadas('3.1.1')) {
            const receitasBrutas = obterValorContaPorFonte('3.1.1', getVarFonte("Receitas Brutas", '3.1.1 RECEITA BRUTA'))
            resultadosIndicadores["Receitas Brutas"][mesNome] = receitasBrutas
          } else {
            resultadosIndicadores["Receitas Brutas"][mesNome] = null
          }
        }

        // Custos
        {
          if (temContasParametrizadas('4.1')) {
            const custos = obterValorContaPorFonte('4.1', getVarFonte("Custos", '4.1 CUSTOS'))
            resultadosIndicadores["Custos"][mesNome] = custos
          } else {
            resultadosIndicadores["Custos"][mesNome] = null
          }
        }

        // Despesas
        {
          if (temContasParametrizadas('4.2')) {
            const despesas = obterValorContaPorFonte('4.2', getVarFonte("Despesas", '4.2 DESPESAS OPERACIONAIS'))
            resultadosIndicadores["Despesas"][mesNome] = despesas
          } else {
            resultadosIndicadores["Despesas"][mesNome] = null
          }
        }

        // Custos e Despesas
        {
          if (temContasParametrizadas('4')) {
            const custosEDespesas = obterValorContaPorFonte('4', getVarFonte("Custos e Despesas", '4 CUSTOS E DESPESAS'))
            resultadosIndicadores["Custos e Despesas"][mesNome] = custosEDespesas
          } else {
            resultadosIndicadores["Custos e Despesas"][mesNome] = null
          }
        }

        // Margem de Contribuição
        {
          if (temContasParametrizadas('3') && temContasParametrizadas('4.1')) {
            const receitas = obterValorContaPorFonte('3', getVarFonte("Margem de Contribuição", '3 RECEITAS'))
            const custos = obterValorContaPorFonte('4.1', getVarFonte("Margem de Contribuição", '4.1 CUSTOS'))
            resultadosIndicadores["Margem de Contribuição"][mesNome] = receitas - custos
          } else {
            resultadosIndicadores["Margem de Contribuição"][mesNome] = null
          }
        }

        // Deduções das Receitas
        {
          const contaExists = temContasParametrizadas('3.1.2')
          console.log(`[NOVO INDICADOR] Deduções das Receitas - Mês ${mes}:`)
          console.log(`  - Conta 3.1.2 parametrizada: ${contaExists}`)
          
          if (contaExists) {
            const deducoes = obterValorContaPorFonte('3.1.2', getVarFonte("Deduções das Receitas", '3.1.2 - DEDUÇÕES DA RECEITA'))
            resultadosIndicadores["Deduções das Receitas"][mesNome] = deducoes
            console.log(`  - Valor calculado: ${deducoes}`)
          } else {
            resultadosIndicadores["Deduções das Receitas"][mesNome] = null
            console.log(`  - Indicador não calculado: conta '3.1.2 - DEDUÇÕES DA RECEITA' não parametrizada`)
          }
        }

        // Outras Receitas Operacionais
        {
          const contaExists = temContasParametrizadas('3.1.3')
          console.log(`[NOVO INDICADOR] Outras Receitas Operacionais - Mês ${mes}:`)
          console.log(`  - Conta 3.1.3 parametrizada: ${contaExists}`)
          
          if (contaExists) {
            const outrasReceitas = obterValorContaPorFonte('3.1.3', getVarFonte("Outras Receitas Operacionais", '3.1.3 - RECEITA FINANCEIRA'))
            resultadosIndicadores["Outras Receitas Operacionais"][mesNome] = outrasReceitas
            console.log(`  - Valor calculado: ${outrasReceitas}`)
          } else {
            resultadosIndicadores["Outras Receitas Operacionais"][mesNome] = null
            console.log(`  - Indicador não calculado: conta '3.1.3 - RECEITA FINANCEIRA' não parametrizada`)
          }
        }

        // Resultado Líquido
        {
          if (temContasParametrizadas('3') && temContasParametrizadas('4')) {
            const receitas = obterValorContaPorFonte('3', getVarFonte("Resultado Líquido", '3 RECEITAS'))
            const custosEDespesas = obterValorContaPorFonte('4', getVarFonte("Resultado Líquido", '4 CUSTOS E DESPESAS'))
            resultadosIndicadores["Resultado Líquido"][mesNome] = receitas - custosEDespesas
          } else {
            resultadosIndicadores["Resultado Líquido"][mesNome] = null
          }
        }

        // Resultado Líquido Acumulado
        {
          if (temContasParametrizadas('3') && temContasParametrizadas('4')) {
            const receitas = obterValorContaPorFonte('3', getVarFonte("Resultado Líquido Acumulado", '3 RECEITAS'))
            const custosEDespesas = obterValorContaPorFonte('4', getVarFonte("Resultado Líquido Acumulado", '4 CUSTOS E DESPESAS'))
            resultadosIndicadores["Resultado Líquido Acumulado"][mesNome] = receitas - custosEDespesas
          } else {
            resultadosIndicadores["Resultado Líquido Acumulado"][mesNome] = null
          }
        }

        // ROE – Return on Equity (Retorno sobre o Patrimônio Líquido)
        {
          if (temContasParametrizadas('3') && temContasParametrizadas('4') && temContasParametrizadas('2.3')) {
            const lucroLiquido = obterValorContaPorFonte('3', 'movimento') - obterValorContaPorFonte('4', 'movimento')
            const plAtual = obterValorContaCampo('2.3', 'saldo_atual')
            const plAnterior = obterValorContaCampo('2.3', 'saldo_anterior')
            const plMedio = (plAtual + plAnterior) / 2
            resultadosIndicadores["ROE – Return on Equity (Retorno sobre o Patrimônio Líquido)"][mesNome] = plMedio !== 0 ? (lucroLiquido / plMedio) * 100 : null
          } else {
            resultadosIndicadores["ROE – Return on Equity (Retorno sobre o Patrimônio Líquido)"][mesNome] = null
          }
        }

        // ROA – Return on Assets (Retorno sobre Ativos)
        {
          if (temContasParametrizadas('3') && temContasParametrizadas('4') && temContasParametrizadas('1.1') && temContasParametrizadas('1.2')) {
            const lucroLiquido = obterValorContaPorFonte('3', 'movimento') - obterValorContaPorFonte('4', 'movimento')
            const atAtual = obterValorContaCampo('1.1', 'saldo_atual') + obterValorContaCampo('1.2', 'saldo_atual')
            const atAnterior = obterValorContaCampo('1.1', 'saldo_anterior') + obterValorContaCampo('1.2', 'saldo_anterior')
            const atMedio = (atAtual + atAnterior) / 2
            resultadosIndicadores["ROA – Return on Assets (Retorno sobre Ativos)"][mesNome] = atMedio !== 0 ? (lucroLiquido / atMedio) * 100 : null
          } else {
            resultadosIndicadores["ROA – Return on Assets (Retorno sobre Ativos)"][mesNome] = null
          }
        }

        // EBITDA – Earnings Before Interest, Taxes, Depreciation and Amortization
        {
            if (temContasParametrizadas('3') && temContasParametrizadas('4')) {
              const lucroOperacional = obterValorContaPorFonte('3', 'movimento') - obterValorContaPorFonte('4', 'movimento')
              const tributos = (temContasParametrizadas('3.1.2') ? obterValorContaPorFonte('3.1.2', 'movimento') : 0) + (temContasParametrizadas('4.2.3') ? obterValorContaPorFonte('4.2.3', 'movimento') : 0)
              const depreciacaoEAmo = temContasParametrizadas('4.2.1.4') ? obterValorContaPorFonte('4.2.1.4', 'movimento') : 0
              resultadosIndicadores["EBITDA – Earnings Before Interest, Taxes, Depreciation and Amortization"][mesNome] = lucroOperacional + tributos + depreciacaoEAmo
            } else {
            resultadosIndicadores["EBITDA – Earnings Before Interest, Taxes, Depreciation and Amortization"][mesNome] = null
          }
        }

        // Peso dos Custos sobre a Receita
        {
          if (temContasParametrizadas('4.1') && temContasParametrizadas('3.1.1')) {
            const custos = obterValorContaPorFonte('4.1', getVarFonte("Peso dos Custos sobre a Receita", '4.1 CUSTOS'))
            const receitaBruta = obterValorContaPorFonte('3.1.1', getVarFonte("Peso dos Custos sobre a Receita", '3.1.1 RECEITA BRUTA'))
            resultadosIndicadores["Peso dos Custos sobre a Receita"][mesNome] = receitaBruta !== 0 ? (custos / receitaBruta) * 100 : null
          } else {
            resultadosIndicadores["Peso dos Custos sobre a Receita"][mesNome] = null
          }
        }

        // Peso das Despesas sobre a Receita
        {
          if (temContasParametrizadas('4.2') && temContasParametrizadas('3.1.1')) {
            const despesas = obterValorContaPorFonte('4.2', getVarFonte("Peso das Despesas sobre a Receita", '4.2 DESPESAS OPERACIONAIS'))
            const receitaBruta = obterValorContaPorFonte('3.1.1', getVarFonte("Peso das Despesas sobre a Receita", '3.1.1 RECEITA BRUTA'))
            resultadosIndicadores["Peso das Despesas sobre a Receita"][mesNome] = receitaBruta !== 0 ? (despesas / receitaBruta) * 100 : null
          } else {
            resultadosIndicadores["Peso das Despesas sobre a Receita"][mesNome] = null
          }
        }

        // Peso dos Tributos sobre a Receita
        {
          if (temContasParametrizadas('3.1.1')) {
            const despesasTributarias = temContasParametrizadas('4.2.3') ? obterValorContaPorFonte('4.2.3', getVarFonte("Peso dos Tributos sobre a Receita", '4.2.3 DESPESAS TRIBUTÁRIAS')) : 0
            const iss = temContasParametrizadas('3.1.2.1') ? obterValorContaPorFonte('3.1.2.1', getVarFonte("Peso dos Tributos sobre a Receita", '3.1.2.1 ISS')) : 0
            const simplesNacional = temContasParametrizadas('3.1.2.2') ? obterValorContaPorFonte('3.1.2.2', getVarFonte("Peso dos Tributos sobre a Receita", '3.1.2.2 SIMPLES NACIONAL')) : 0
            const pis = temContasParametrizadas('3.1.2.3') ? obterValorContaPorFonte('3.1.2.3', getVarFonte("Peso dos Tributos sobre a Receita", '3.1.2.3 PIS')) : 0
            const cofins = temContasParametrizadas('3.1.2.4') ? obterValorContaPorFonte('3.1.2.4', getVarFonte("Peso dos Tributos sobre a Receita", '3.1.2.4 COFINS')) : 0
            const icms = temContasParametrizadas('3.1.2.5') ? obterValorContaPorFonte('3.1.2.5', getVarFonte("Peso dos Tributos sobre a Receita", '3.1.2.5 ICMS')) : 0
            const receitaBruta = obterValorContaPorFonte('3.1.1', getVarFonte("Peso dos Tributos sobre a Receita", '3.1.1 RECEITA BRUTA'))
            const totalTributos = despesasTributarias + iss + simplesNacional + pis + cofins + icms
            resultadosIndicadores["Peso dos Tributos sobre a Receita"][mesNome] = receitaBruta !== 0 ? (totalTributos / receitaBruta) * 100 : null
          } else {
            resultadosIndicadores["Peso dos Tributos sobre a Receita"][mesNome] = null
          }
        }

        // Peso da Folha sobre a Receita
        {
          if (temContasParametrizadas('4.1.2') && temContasParametrizadas('4.1.3') && temContasParametrizadas('3.1.1')) {
            const custosComPessoal = obterValorContaPorFonte('4.1.2', getVarFonte("Peso da Folha sobre a Receita", '4.1.2 CUSTOS COM PESSOAL'))
            const custosComEncargos = obterValorContaPorFonte('4.1.3', getVarFonte("Peso da Folha sobre a Receita", '4.1.3 CUSTOS COM ENCARGOS SOCIAIS'))
            const receitaBruta = obterValorContaPorFonte('3.1.1', getVarFonte("Peso da Folha sobre a Receita", '3.1.1 RECEITA BRUTA'))
            const totalFolha = custosComPessoal + custosComEncargos
            resultadosIndicadores["Peso da Folha sobre a Receita"][mesNome] = receitaBruta !== 0 ? (totalFolha / receitaBruta) * 100 : null
          } else {
            resultadosIndicadores["Peso da Folha sobre a Receita"][mesNome] = null
          }
        }

        // Tributos
        {
          const despesasTributarias = temContasParametrizadas('4.2.3') ? obterValorContaPorFonte('4.2.3', getVarFonte("Tributos", '4.2.3 DESPESAS TRIBUTÁRIAS')) : 0
          const iss = temContasParametrizadas('3.1.2.1') ? obterValorContaPorFonte('3.1.2.1', getVarFonte("Tributos", '3.1.2.1 ISS')) : 0
          const simplesNacional = temContasParametrizadas('3.1.2.2') ? obterValorContaPorFonte('3.1.2.2', getVarFonte("Tributos", '3.1.2.2 SIMPLES NACIONAL')) : 0
          const pis = temContasParametrizadas('3.1.2.3') ? obterValorContaPorFonte('3.1.2.3', getVarFonte("Tributos", '3.1.2.3 PIS')) : 0
          const cofins = temContasParametrizadas('3.1.2.4') ? obterValorContaPorFonte('3.1.2.4', getVarFonte("Tributos", '3.1.2.4 COFINS')) : 0
          const icms = temContasParametrizadas('3.1.2.5') ? obterValorContaPorFonte('3.1.2.5', getVarFonte("Tributos", '3.1.2.5 ICMS')) : 0
          const totalTributos = despesasTributarias + iss + simplesNacional + pis + cofins + icms
          resultadosIndicadores["Tributos"][mesNome] = totalTributos
        }

        // Folha e Encargos
        {
          const custosComPessoal = temContasParametrizadas('4.1.2') ? obterValorContaPorFonte('4.1.2', getVarFonte("Folha e Encargos", '4.1.2 CUSTOS COM PESSOAL')) : 0
          const custosComEncargos = temContasParametrizadas('4.1.3') ? obterValorContaPorFonte('4.1.3', getVarFonte("Folha e Encargos", '4.1.3 CUSTOS COM ENCARGOS SOCIAIS')) : 0
          const totalFolhaEncargos = custosComPessoal + custosComEncargos
          resultadosIndicadores["Folha e Encargos"][mesNome] = totalFolhaEncargos
        }
      })

      setIndicadores(resultadosIndicadores)
      setDadosDetalhados(dadosPorMes)
      
      // Definir mês mais recente como padrão
      if (mesesOrdenados.length > 0) {
        const mesRecente = nomesMeses[mesesOrdenados[mesesOrdenados.length - 1] - 1]
        setMesSelecionado(mesRecente)
      }

      // Retornar os resultados para uso na função de salvar
      return { resultadosIndicadores, dadosPorMes, mesesOrdenados }

    } catch (error) {
      console.error('Erro ao calcular indicadores:', error)
      throw error // Re-throw para ser capturado pela função que chama
    }
  }

  const formatarValor = (valor: number | null, indicador: string): string => {
    if (valor === null || valor === undefined) return "–"
    
    const isPercent = indicador.includes("(%)") || indicador.startsWith("ROE") || indicador.startsWith("ROA") || indicador.startsWith("Peso")
    const isCurrency = indicador.includes("CCL") || 
                indicador === "Receitas Líquidas" || 
                indicador === "Receitas Brutas" || 
                indicador === "Custos" || 
                indicador === "Despesas" || 
                indicador === "Custos e Despesas" || 
                indicador === "Margem de Contribuição" ||
                indicador === "Deduções das Receitas" ||
                indicador === "Outras Receitas Operacionais" ||
                 indicador === "Tributos" ||
                 indicador === "Folha e Encargos" ||
                 indicador === "Resultado Líquido" ||
                 indicador === "Resultado Líquido Acumulado" ||
                 indicador === "EBITDA – Earnings Before Interest, Taxes, Depreciation and Amortization" ||
                indicador === "Necessidade de Capital de Giro (NCG)"
  
    if (isPercent) {
      return `${valor.toFixed(2)}%`
    } else if (isCurrency) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valor)
    } else if (indicador.includes("PMP") || indicador.includes("PME") || indicador.includes("PMR") || 
               indicador.includes("CO") || indicador.includes("CF")) {
      return `${valor.toFixed(0)} dias`
    } else {
      return valor.toFixed(2)
    }
  }

  const obterFormula = (indicador: string): string => {
    const formulas: { [key: string]: string } = {
      "Liquidez Corrente": "Ativo Circulante ÷ Passivo Circulante",
      "Liquidez Seca": "(Ativo Circulante – Estoques) ÷ Passivo Circulante",
      "Liquidez Geral": "(Ativo Circulante + Realizável a Longo Prazo) ÷ (Passivo Circulante + Exigível a Longo Prazo)",
      "Participação de Capitais de Terceiros (PCT)": "(Passivo Circulante + Passivo Não Circulante) ÷ Patrimônio Líquido",
      "Composição do Endividamento (CE)": "Passivo Circulante ÷ (Passivo Circulante + Passivo Não Circulante)",
      "Imobilização do Patrimônio Líquido (IPL)": "(Imobilizado - Depreciação Acumulada) ÷ Patrimônio Líquido",
      "Margem Bruta (%)": "(Lucro Bruto ÷ Receita Líquida) × 100",
      "Margem Líquida (%)": "((3 RECEITAS - 4.1 CUSTOS - 4.2 DESPESAS OPERACIONAIS) ÷ 3 RECEITAS) × 100",
      "Margem Líquida Acumulada (%)": "((3 RECEITAS - 4.1 CUSTOS - 4.2 DESPESAS OPERACIONAIS) ÷ 3 RECEITAS) × 100",
      "Giro do Ativo": "(Receita Líquida ÷ Ativo Total) × 12",
      "Capital Circulante Líquido (CCL)": "Ativo Circulante – Passivo Circulante",
      "Receitas Líquidas": "3 RECEITAS",
      "Receitas Brutas": "3.1.1 RECEITA BRUTA",
      "Custos": "4.1 CUSTOS",
      "Despesas": "4.2 DESPESAS OPERACIONAIS",
      "Custos e Despesas": "4 CUSTOS E DESPESAS",
      "Margem de Contribuição": "3 RECEITAS − 4.1 CUSTOS",
      "Deduções das Receitas": "3.1.2 - DEDUÇÕES DA RECEITA",
      "Outras Receitas Operacionais": "3.1.3 - RECEITA FINANCEIRA",
      "Tributos": "4.2.3 DESPESAS TRIBUTÁRIAS + 3.1.2.1 ISS + 3.1.2.2 SIMPLES NACIONAL + 3.1.2.3 PIS + 3.1.2.4 COFINS + 3.1.2.5 ICMS",
      "Folha e Encargos": "4.1.2 CUSTOS COM PESSOAL + 4.1.3 CUSTOS COM ENCARGOS SOCIAIS",
      "Resultado Líquido": "3 RECEITAS − 4 CUSTOS E DESPESAS",
      "Resultado Líquido Acumulado": "3 RECEITAS − 4 CUSTOS E DESPESAS",
      "ROE – Return on Equity (Retorno sobre o Patrimônio Líquido)": "((3 RECEITAS − 4 CUSTOS E DESPESAS) ÷ Patrimônio Líquido Médio) × 100",
      "ROA – Return on Assets (Retorno sobre Ativos)": "((3 RECEITAS − 4 CUSTOS E DESPESAS) ÷ Ativo Total Médio) × 100",
      "EBITDA – Earnings Before Interest, Taxes, Depreciation and Amortization": "Lucro Operacional + Tributos + Depreciação e Amortização",
      "Prazo Médio de Pagamento (PMP)": "(2.1.1 FORNECEDORES ÷ (4.1 CUSTOS − 4.1.2 CUSTOS COM PESSOAL − 4.1.3 CUSTOS COM ENCARGOS SOCIAIS)) × (360 ÷ 12 × número do mês)",
      "Prazo Médio de Estocagem (PME)": "(1.1.4 ESTOQUES ÷ (4.1 CUSTOS − 4.1.2 CUSTOS COM PESSOAL − 4.1.3 CUSTOS COM ENCARGOS SOCIAIS)) × (360 ÷ 12 × número do mês)",
      "Prazo Médio de Recebimento (PMR)": "(1.1.2.1 CLIENTES ÷ 3.1.1 RECEITA BRUTA) × (360 ÷ 12 × número do mês)",
      "Ciclo Operacional (CO)": "Prazo Médio de Estocagem + Prazo Médio de Recebimento",
      "Ciclo Financeiro (CF)": "Ciclo Operacional − Prazo Médio de Pagamento",
      "Necessidade de Capital de Giro (NCG)": "(1.1 ATIVO CIRCULANTE − 2.1 PASSIVO CIRCULANTE) × -1",
      "Peso dos Custos sobre a Receita": "(4.1 CUSTOS ÷ 3.1.1 RECEITA BRUTA) × 100",
      "Peso das Despesas sobre a Receita": "(4.2 DESPESAS OPERACIONAIS ÷ 3.1.1 RECEITA BRUTA) × 100",
      "Peso dos Tributos sobre a Receita": "((4.2.3 DESPESAS TRIBUTÁRIAS + 3.1.2.1 ISS + 3.1.2.2 SIMPLES NACIONAL + 3.1.2.3 PIS + 3.1.2.4 COFINS + 3.1.2.5 ICMS) ÷ 3.1.1 RECEITA BRUTA) × 100",
      "Peso da Folha sobre a Receita": "((4.1.2 CUSTOS COM PESSOAL + 4.1.3 CUSTOS COM ENCARGOS SOCIAIS) ÷ 3.1.1 RECEITA BRUTA) × 100"
    }
    return formulas[indicador] || ""
  }

  const obterDetalhesCalculo = (indicador: string, mes: string) => {
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const mesIndex = nomesMeses.findIndex(m => m === mes)
    const mesNumero = mesIndex + 1
    
    const dados = dadosDetalhados[mesNumero]
    if (!dados) {
      return { componentes: [], resultado: null, erro: "Não há dados parametrizados para este mês" }
    }

    const formatarMoeda = (valor: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valor)
    }

    // Funções para obter valores por campo/fonte (saldo_atual, saldo_anterior, movimento)
    const obterValorContaCampo = (codigo: string, campo: 'saldo_atual' | 'saldo_anterior'): number => {
      if (dados[codigo]?.[campo] !== undefined) {
        return dados[codigo][campo]
      }
      let total = 0
      const proximoNivel = codigo + '.'
      for (const [codigoConta, valores] of Object.entries(dados)) {
        if (codigoConta.startsWith(proximoNivel)) {
          const parteFilha = codigoConta.substring(proximoNivel.length)
          if (!parteFilha.includes('.')) {
            const v = valores as { saldo_atual: number; saldo_anterior: number }
            total += v[campo] || 0
          }
        }
      }
      return total
    }

    const obterValorContaPorFonte = (codigo: string, fonte: FonteColuna): number => {
      switch (fonte) {
        case 'saldo_anterior':
          return obterValorContaCampo(codigo, 'saldo_anterior')
        case 'movimento':
          return obterValorContaCampo(codigo, 'saldo_atual') - obterValorContaCampo(codigo, 'saldo_anterior')
        case 'saldo_atual':
        default:
          return obterValorContaCampo(codigo, 'saldo_atual')
      }
    }

    const comp = (label: string, codigo: string) => {
      const fonte = getVarFonte(indicador, label)
      const valor = obterValorContaPorFonte(codigo, fonte)
      return { label, valor, fonte }
    }

    switch (indicador) {
      case "Liquidez Corrente": {
        const ac = comp('Ativo Circulante', '1.1')
        const pc = comp('Passivo Circulante', '2.1')
        return {
          componentes: [ac, pc],
          resultado: pc.valor > 0 ? ac.valor / pc.valor : null
        }
      }

      case "Liquidez Seca": {
        const ac = comp('Ativo Circulante', '1.1')
        const est = comp('Estoques', '1.1.4')
        const pc = comp('Passivo Circulante', '2.1')
        return {
          componentes: [ac, est, pc],
          resultado: pc.valor > 0 ? (ac.valor - est.valor) / pc.valor : null
        }
      }

      case "Liquidez Geral": {
        const ac = comp('Ativo Circulante', '1.1')
        const rlp = comp('Realizável a Longo Prazo', '1.2.1')
        const pc = comp('Passivo Circulante', '2.1')
        const pnc = comp('Exigível a Longo Prazo', '2.2')
        const denom = pc.valor + pnc.valor
        return {
          componentes: [ac, rlp, pc, pnc],
          resultado: denom !== 0 ? (ac.valor + rlp.valor) / denom : null
        }
      }

      case "Participação de Capitais de Terceiros (PCT)": {
        const pc = comp('Passivo Circulante', '2.1')
        const pnc = comp('Passivo Não Circulante', '2.2')
        const pl = comp('Patrimônio Líquido', '2.3')
        return {
          componentes: [pc, pnc, pl],
          resultado: pl.valor !== 0 ? (pc.valor + pnc.valor) / pl.valor : null
        }
      }

      case "Composição do Endividamento (CE)": {
        const pc = comp('Passivo Circulante', '2.1')
        const pnc = comp('Passivo Não Circulante', '2.2')
        const passivoTotal = pc.valor + pnc.valor
        return {
          componentes: [pc, { label: 'Passivo Total', valor: passivoTotal }],
          resultado: passivoTotal > 0 ? pc.valor / passivoTotal : null
        }
      }

      case "Imobilização do Patrimônio Líquido (IPL)": {
        const imob = comp('Imobilizado', '1.2.3')
        const deprec = comp('Depreciação Acumulada', '1.2.4')
        const pl = comp('Patrimônio Líquido', '2.3')
        return {
          componentes: [imob, { label: 'Depreciação Acumulada (sem sinal)', valor: Math.abs(deprec.valor), fonte: deprec.fonte }, pl],
          resultado: pl.valor !== 0 ? (imob.valor - Math.abs(deprec.valor)) / pl.valor : null
        }
      }

      case "Margem Bruta (%)": {
        const rec = comp('Receitas', '3.1')
        const custos41 = comp('Custos', '4.1')
        const lucroBruto = rec.valor - custos41.valor
        return {
          componentes: [rec, custos41, { label: 'Lucro Bruto', valor: lucroBruto }],
          resultado: rec.valor > 0 ? (lucroBruto / rec.valor) * 100 : null
        }
      }

      case "Margem Líquida (%)": {
        const rec = comp('Receitas', '3.1')
        const custos41 = comp('Custos', '4.1')
        const despesas42 = comp('Despesas', '4.2')
        const lucroLiquido = rec.valor - custos41.valor - despesas42.valor
        return {
          componentes: [rec, custos41, despesas42, { label: 'Lucro Líquido', valor: lucroLiquido }],
          resultado: rec.valor > 0 ? (lucroLiquido / rec.valor) * 100 : null
        }
      }

      case "Margem Líquida Acumulada (%)": {
        const rec = comp('3 RECEITAS', '3')
        const custos41 = comp('4.1 CUSTOS', '4.1')
        const despesas42 = comp('4.2 DESPESAS OPERACIONAIS', '4.2')
        const lucroLiquidoAcumulado = rec.valor - custos41.valor - despesas42.valor
        return {
          componentes: [rec, custos41, despesas42, { label: 'Lucro Líquido Acumulado', valor: lucroLiquidoAcumulado }],
          resultado: rec.valor > 0 ? (lucroLiquidoAcumulado / rec.valor) * 100 : null
        }
      }

      case "Giro do Ativo": {
        const rec = comp('Receitas', '3.1')
        const ac = comp('Ativo Circulante', '1.1')
        const anc = comp('Ativo Não Circulante', '1.2')
        const at = ac.valor + anc.valor
        return {
          componentes: [rec, { label: 'Ativo Total', valor: at }],
          resultado: at !== 0 && rec.valor !== 0 ? (rec.valor / at) * 12 : null
        }
      }

      case "Capital Circulante Líquido (CCL)": {
        const ac = comp('Ativo Circulante', '1.1')
        const pc = comp('Passivo Circulante', '2.1')
        return {
          componentes: [ac, pc],
          resultado: ac.valor - pc.valor
        }
      }

      case "Receitas Líquidas": {
        const receitas = comp('3 RECEITAS', '3')
        return {
          componentes: [receitas],
          resultado: receitas.valor
        }
      }

      case "Receitas Brutas": {
        const receitasBrutas = comp('3.1.1 RECEITA BRUTA', '3.1.1')
        return {
          componentes: [receitasBrutas],
          resultado: receitasBrutas.valor
        }
      }

      case "Custos": {
        const custos = comp('4.1 CUSTOS', '4.1')
        return {
          componentes: [custos],
          resultado: custos.valor
        }
      }

      case "Despesas": {
        const despesas = comp('4.2 DESPESAS OPERACIONAIS', '4.2')
        return {
          componentes: [despesas],
          resultado: despesas.valor
        }
      }

      case "Custos e Despesas": {
        const custosEDespesas = comp('4 CUSTOS E DESPESAS', '4')
        return {
          componentes: [custosEDespesas],
          resultado: custosEDespesas.valor
        }
      }

      case "Margem de Contribuição": {
        const receitas = comp('3 RECEITAS', '3')
        const custos = comp('4.1 CUSTOS', '4.1')
        const margem = receitas.valor - custos.valor
        return {
          componentes: [receitas, custos, { label: 'Margem de Contribuição', valor: margem }],
          resultado: margem
        }
      }

      case "Deduções das Receitas": {
        const deducoes = comp('3.1.2 - DEDUÇÕES DA RECEITA', '3.1.2')
        return {
          componentes: [deducoes],
          resultado: deducoes.valor
        }
      }

      case "Outras Receitas Operacionais": {
        const outrasReceitas = comp('3.1.3 - RECEITA FINANCEIRA', '3.1.3')
        return {
          componentes: [outrasReceitas],
          resultado: outrasReceitas.valor
        }
      }

      case "Tributos": {
        const despesasTributarias = comp('4.2.3 DESPESAS TRIBUTÁRIAS', '4.2.3')
        const iss = comp('3.1.2.1 ISS', '3.1.2.1')
        const simplesNacional = comp('3.1.2.2 SIMPLES NACIONAL', '3.1.2.2')
        const pis = comp('3.1.2.3 PIS', '3.1.2.3')
        const cofins = comp('3.1.2.4 COFINS', '3.1.2.4')
        const icms = comp('3.1.2.5 ICMS', '3.1.2.5')
        const totalTributos = despesasTributarias.valor + iss.valor + simplesNacional.valor + pis.valor + cofins.valor + icms.valor
        return {
          componentes: [despesasTributarias, iss, simplesNacional, pis, cofins, icms, { label: 'Total Tributos', valor: totalTributos }],
          resultado: totalTributos
        }
      }

      case "Folha e Encargos": {
        const custosComPessoal = comp('4.1.2 CUSTOS COM PESSOAL', '4.1.2')
        const custosComEncargos = comp('4.1.3 CUSTOS COM ENCARGOS SOCIAIS', '4.1.3')
        const totalFolhaEncargos = custosComPessoal.valor + custosComEncargos.valor
        return {
          componentes: [custosComPessoal, custosComEncargos, { label: 'Total Folha e Encargos', valor: totalFolhaEncargos }],
          resultado: totalFolhaEncargos
        }
      }

      case "Resultado Líquido": {
        const receitas = comp('3 RECEITAS', '3')
        const custosEDespesas = comp('4 CUSTOS E DESPESAS', '4')
        const resultado = receitas.valor - custosEDespesas.valor
        return {
          componentes: [receitas, custosEDespesas, { label: 'Resultado Líquido', valor: resultado }],
          resultado
        }
      }

      case "Resultado Líquido Acumulado": {
        const receitas = comp('3 RECEITAS', '3')
        const custosEDespesas = comp('4 CUSTOS E DESPESAS', '4')
        const resultado = receitas.valor - custosEDespesas.valor
        return {
          componentes: [receitas, custosEDespesas, { label: 'Resultado Líquido Acumulado', valor: resultado }],
          resultado
        }
      }

      case "Prazo Médio de Pagamento (PMP)": {
        const fornecedores = comp('2.1.1 FORNECEDORES', '2.1.1')
        const custos = comp('4.1 CUSTOS', '4.1')
        const custosComPessoal = comp('4.1.2 CUSTOS COM PESSOAL', '4.1.2')
        const custosComEncargos = comp('4.1.3 CUSTOS COM ENCARGOS SOCIAIS', '4.1.3')
        const comprasAPrazo = custos.valor - custosComPessoal.valor - custosComEncargos.valor
        const mesNumero = mesesExibidos.indexOf(mesSelecionado) + 1
         const fatorTempo = (360 / 12) * mesNumero
        const resultado = comprasAPrazo !== 0 ? (fornecedores.valor / comprasAPrazo) * fatorTempo : null
        return {
          componentes: [fornecedores, { label: 'Compras a Prazo', valor: comprasAPrazo }, { label: 'Fator Tempo', valor: fatorTempo }],
          resultado
        }
      }

      case "Prazo Médio de Estocagem (PME)": {
        const estoques = comp('1.1.4 ESTOQUES', '1.1.4')
        const custos = comp('4.1 CUSTOS', '4.1')
        const custosComPessoal = comp('4.1.2 CUSTOS COM PESSOAL', '4.1.2')
        const custosComEncargos = comp('4.1.3 CUSTOS COM ENCARGOS SOCIAIS', '4.1.3')
        const custoMercadoriasVendidas = custos.valor - custosComPessoal.valor - custosComEncargos.valor
        const mesNumero = mesesExibidos.indexOf(mesSelecionado) + 1
        const fatorTempo = 360 / (12 * mesNumero)
        const resultado = custoMercadoriasVendidas !== 0 ? (estoques.valor / custoMercadoriasVendidas) * fatorTempo : null
        return {
          componentes: [estoques, { label: 'Custo Mercadorias Vendidas', valor: custoMercadoriasVendidas }, { label: 'Fator Tempo', valor: fatorTempo }],
          resultado
        }
      }

      case "Prazo Médio de Recebimento (PMR)": {
        const clientes = comp('1.1.2.1 CLIENTES', '1.1.2.1')
        const vendasAPrazo = comp('3.1.1 RECEITA BRUTA', '3.1.1')
        const mesNumero = mesesExibidos.indexOf(mesSelecionado) + 1
        const fatorTempo = 360 / (12 * mesNumero)
        const resultado = vendasAPrazo.valor !== 0 ? (clientes.valor / vendasAPrazo.valor) * fatorTempo : null
        return {
          componentes: [clientes, vendasAPrazo, { label: 'Fator Tempo', valor: fatorTempo }],
          resultado
        }
      }

      case "Ciclo Operacional (CO)": {
        const pme = indicadores["Prazo Médio de Estocagem (PME)"]?.[mesSelecionado] || 0
        const pmr = indicadores["Prazo Médio de Recebimento (PMR)"]?.[mesSelecionado] || 0
        const resultado = pme + pmr
        return {
          componentes: [{ label: 'PME', valor: pme }, { label: 'PMR', valor: pmr }],
          resultado
        }
      }

      case "Ciclo Financeiro (CF)": {
        const co = indicadores["Ciclo Operacional (CO)"]?.[mesSelecionado] || 0
        const pmp = indicadores["Prazo Médio de Pagamento (PMP)"]?.[mesSelecionado] || 0
        const resultado = co - pmp
        return {
          componentes: [{ label: 'CO', valor: co }, { label: 'PMP', valor: pmp }],
          resultado
        }
      }

      case "Necessidade de Capital de Giro (NCG)": {
        const ativoCirculante = comp('1.1 ATIVO CIRCULANTE', '1.1')
        const passivoCirculante = comp('2.1 PASSIVO CIRCULANTE', '2.1')
        const resultado = (ativoCirculante.valor - passivoCirculante.valor) * -1
        return {
          componentes: [ativoCirculante, passivoCirculante],
          resultado
        }
      }

      case "ROE – Return on Equity (Retorno sobre o Patrimônio Líquido)": {
        const receitas = obterValorContaPorFonte('3', 'movimento')
        const custosEDespesas = obterValorContaPorFonte('4', 'movimento')
        const lucroLiquido = receitas - custosEDespesas
        const plAtual = obterValorContaCampo('2.3', 'saldo_atual')
        const plAnterior = obterValorContaCampo('2.3', 'saldo_anterior')
        const plMedio = (plAtual + plAnterior) / 2
        const resultado = plMedio !== 0 ? (lucroLiquido / plMedio) * 100 : null
        return {
          componentes: [
            { label: 'Lucro Líquido', valor: lucroLiquido, fonte: 'movimento' },
            { label: 'PL (Saldo Atual)', valor: plAtual, fonte: 'saldo_atual' },
            { label: 'PL (Saldo Anterior)', valor: plAnterior, fonte: 'saldo_anterior' },
            { label: 'PL Médio', valor: plMedio }
          ],
          resultado
        }
      }

      case "ROA – Return on Assets (Retorno sobre Ativos)": {
        const receitas = obterValorContaPorFonte('3', 'movimento')
        const custosEDespesas = obterValorContaPorFonte('4', 'movimento')
        const lucroLiquido = receitas - custosEDespesas
        const atAtual = obterValorContaCampo('1.1', 'saldo_atual') + obterValorContaCampo('1.2', 'saldo_atual')
        const atAnterior = obterValorContaCampo('1.1', 'saldo_anterior') + obterValorContaCampo('1.2', 'saldo_anterior')
        const atMedio = (atAtual + atAnterior) / 2
        const resultado = atMedio !== 0 ? (lucroLiquido / atMedio) * 100 : null
        return {
          componentes: [
            { label: 'Lucro Líquido', valor: lucroLiquido, fonte: 'movimento' },
            { label: 'Ativo Total (Saldo Atual)', valor: atAtual, fonte: 'saldo_atual' },
            { label: 'Ativo Total (Saldo Anterior)', valor: atAnterior, fonte: 'saldo_anterior' },
            { label: 'Ativo Total Médio', valor: atMedio }
          ],
          resultado
        }
      }

      case "EBITDA – Earnings Before Interest, Taxes, Depreciation and Amortization": {
        const lucroOperacional = obterValorContaPorFonte('3', 'movimento') - obterValorContaPorFonte('4', 'movimento')
        const tributos = obterValorContaPorFonte('3.1.2', 'movimento') + obterValorContaPorFonte('4.2.3', 'movimento')
        const depreciacaoEAmo = obterValorContaPorFonte('4.2.1.4', 'movimento')
        const resultado = lucroOperacional + tributos + depreciacaoEAmo
        return {
          componentes: [
            { label: 'Lucro Operacional', valor: lucroOperacional, fonte: 'movimento' },
            { label: 'Tributos', valor: tributos, fonte: 'movimento' },
            { label: 'Depreciação e Amortização', valor: depreciacaoEAmo, fonte: 'movimento' }
          ],
          resultado
        }
      }

      case "Peso dos Custos sobre a Receita": {
        const custos = comp('4.1 CUSTOS', '4.1')
        const receitaBruta = comp('3.1.1 RECEITA BRUTA', '3.1.1')
        const resultado = receitaBruta.valor !== 0 ? (custos.valor / receitaBruta.valor) * 100 : null
        return {
          componentes: [custos, receitaBruta],
          resultado
        }
      }

      case "Peso das Despesas sobre a Receita": {
        const despesas = comp('4.2 DESPESAS OPERACIONAIS', '4.2')
        const receitaBruta = comp('3.1.1 RECEITA BRUTA', '3.1.1')
        const resultado = receitaBruta.valor !== 0 ? (despesas.valor / receitaBruta.valor) * 100 : null
        return {
          componentes: [despesas, receitaBruta],
          resultado
        }
      }

      case "Peso dos Tributos sobre a Receita": {
        const despesasTributarias = comp('4.2.3 DESPESAS TRIBUTÁRIAS', '4.2.3')
        const iss = comp('3.1.2.1 ISS', '3.1.2.1')
        const simplesNacional = comp('3.1.2.2 SIMPLES NACIONAL', '3.1.2.2')
        const pis = comp('3.1.2.3 PIS', '3.1.2.3')
        const cofins = comp('3.1.2.4 COFINS', '3.1.2.4')
        const icms = comp('3.1.2.5 ICMS', '3.1.2.5')
        const receitaBruta = comp('3.1.1 RECEITA BRUTA', '3.1.1')
        const totalTributos = despesasTributarias.valor + iss.valor + simplesNacional.valor + pis.valor + cofins.valor + icms.valor
        const resultado = receitaBruta.valor !== 0 ? (totalTributos / receitaBruta.valor) * 100 : null
        return {
          componentes: [despesasTributarias, iss, simplesNacional, pis, cofins, icms, receitaBruta, { label: 'Total Tributos', valor: totalTributos }],
          resultado
        }
      }

      case "Peso da Folha sobre a Receita": {
        const custosComPessoal = comp('4.1.2 CUSTOS COM PESSOAL', '4.1.2')
        const custosComEncargos = comp('4.1.3 CUSTOS COM ENCARGOS SOCIAIS', '4.1.3')
        const receitaBruta = comp('3.1.1 RECEITA BRUTA', '3.1.1')
        const totalFolha = custosComPessoal.valor + custosComEncargos.valor
        const resultado = receitaBruta.valor !== 0 ? (totalFolha / receitaBruta.valor) * 100 : null
        return {
          componentes: [custosComPessoal, custosComEncargos, receitaBruta, { label: 'Total Folha', valor: totalFolha }],
          resultado
        }
      }

      default:
        return { componentes: [], resultado: null }
    }
  }

  const toggleIndicador = (indicador: string) => {
    if (indicadorExpandido === indicador) {
      setIndicadorExpandido(null)
    } else {
      setIndicadorExpandido(indicador)
      // Definir mês mais recente como padrão se ainda não foi selecionado
      if (!mesSelecionado && mesesExibidos.length > 0) {
        setMesSelecionado(mesesExibidos[mesesExibidos.length - 1])
      }
    }
  }

  // Botão de informações do indicador com Popover (hover no desktop, clique fixa/solta)
  const InfoIndicatorPopover = ({ indicatorKey, title, description }: { indicatorKey: string; title: string; description?: string }) => {
    const [open, setOpen] = useState(false)
    const [pinned, setPinned] = useState(false)
    const contentId = `ind-desc-${indicatorKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    const isDesktopHover = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches

    return (
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPinned(false) }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Informações sobre ${title}`}
            aria-describedby={contentId}
            onMouseEnter={() => { if (isDesktopHover() && !pinned) setOpen(true) }}
            onMouseLeave={() => { if (isDesktopHover() && !pinned) setOpen(false) }}
            onClick={() => setPinned((p) => { const next = !p; setOpen(next); return next })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned((p) => { const next = !p; setOpen(next); return next }) } }}
            className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Abrir detalhes do indicador</span>
          </button>
        </PopoverTrigger>
        <PopoverContent id={contentId} side="top" align="center" sideOffset={8} avoidCollisions className="w-auto max-w-[320px] p-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{title}</h3>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Descrição não disponível.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="w-full min-h-screen flex justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[95%] xl:max-w-[1360px] space-y-8 py-6">
        {/* Cabeçalho */}
        <div className="space-y-6">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Indicadores Contábeis e Financeiros</h1>
            <p className="text-muted-foreground mt-2">
              Análise comparativa dos principais indicadores empresariais
            </p>
          </div>
          
          {/* Filtros */}
          <Card className="w-full">
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="empresa">Empresa</Label>
                  <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione uma empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((empresa) => (
                        <SelectItem key={empresa.cnpj} value={empresa.cnpj}>
                          {empresa.nome_empresarial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ano">Ano</Label>
                  <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {anosDisponiveis.map((ano) => (
                        <SelectItem key={ano} value={ano.toString()}>
                          {ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2 lg:col-span-1 flex gap-2">
                  <Button 
                    onClick={buscarIndicadores} 
                    disabled={loading || !empresaSelecionada || !anoSelecionado}
                    className="flex-1 h-10"
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Search className="w-4 h-4 mr-2 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Buscar Indicadores
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={recalcularESalvar} 
                    disabled={loadingSave || !empresaSelecionada || !anoSelecionado}
                    className="flex-1 h-10"
                  >
                    {loadingSave ? (
                      <>
                        <Save className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-4 h-4 mr-2" />
                        Recalcular e Salvar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Indicadores */}
        <Card className="w-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Tabela de Indicadores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative border rounded-lg overflow-hidden">
              {/* Container com scroll horizontal */}
              <div className="overflow-x-auto">
                <Table className="relative">
                  <TableHeader className="sticky top-0 bg-background z-10 border-b">
                    <TableRow>
                      {/* Primeira coluna fixa - Indicadores */}
                      <TableHead className="sticky left-0 bg-background z-20 min-w-[280px] border-r font-semibold text-left px-4">
                        Indicador
                      </TableHead>
                      {/* Colunas dos meses */}
                      {mesesExibidos.map((mes) => (
                        <TableHead 
                          key={mes} 
                          className="text-center min-w-[120px] font-semibold px-3"
                        >
                          {mes}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {categorias.map((cat) => {
                       // Permitir futura filtragem mantendo cabeçalhos das categorias
                       const itensVisiveis = cat.itens.filter((n) => nomeIndicadores.includes(n))
                       if (itensVisiveis.length === 0) return null

                       return (
                         <>
                           {/* Cabeçalho da categoria */}
                           <TableRow key={`header-${cat.titulo}`}>
                             <TableCell colSpan={mesesExibidos.length + 1} className="px-4 py-2 bg-primary/10 text-primary font-semibold uppercase tracking-wide">
                               {cat.titulo}
                             </TableCell>
                           </TableRow>

                           {/* Indicadores da categoria */}
                           {itensVisiveis.map((indicador) => {
                             const rowIndex = nomeIndicadores.indexOf(indicador)
                             return (
                               <>
                                 <TableRow
                                   key={indicador}
                                   className={rowIndex % 2 === 0 ? "bg-background hover:bg-muted/50" : "bg-muted/30 hover:bg-muted/60"}
                                 >
                                   {/* Primeira coluna fixa - Nome do indicador com ícone expansível */}
                                   <TableCell className="sticky left-0 bg-inherit z-10 border-r font-medium px-4 py-3">
                                     <div className="flex items-center gap-2">
                                       <button
                                         onClick={() => toggleIndicador(indicador)}
                                         className="text-muted-foreground hover:text-foreground transition-colors"
                                       >
                                         {indicadorExpandido === indicador ? (
                                           <ChevronDown className="h-4 w-4" />
                                         ) : (
                                           <ChevronRight className="h-4 w-4" />
                                         )}
                                       </button>
                                       <div className="flex items-center gap-2">
                                         <div className="flex flex-col">
                                           <span className="flex items-center gap-2">
                                             {indicador}
                                           </span>
                                           {indicador === "Participação de Capitais de Terceiros (PCT)" && (
                                             <span className="text-xs text-muted-foreground">Grau de Endividamento</span>
                                           )}
                                         </div>
                                         <InfoIndicatorPopover
                                           indicatorKey={indicador}
                                           title={indicador}
                                           description={descricaoIndicadores[indicador]}
                                         />
                                       </div>
                                     </div>
                                   </TableCell>
                                   {/* Células dos meses com valores calculados */}
                                   {mesesExibidos.map((mes) => (
                                     <TableCell
                                       key={mes}
                                       className="text-center px-3 py-3"
                                     >
                                       {formatarValor(indicadores[indicador]?.[mes] || null, indicador)}
                                     </TableCell>
                                   ))}
                                 </TableRow>

                                 {/* Linha expandida com detalhes do cálculo */}
                                 {indicadorExpandido === indicador && (
                                   <TableRow key={`${indicador}-detalhes`}>
                                     <TableCell
                                       colSpan={mesesExibidos.length + 1}
                                       className="sticky left-0 bg-muted/20 border-b border-border px-4 py-6"
                                     >
                                       <div className="space-y-4">
                                         {/* Seleção de mês */}
                                         <div>
                                           <Label className="text-sm font-medium mb-3 block">
                                             Selecione o mês para ver os detalhes do cálculo:
                                           </Label>
                                           <RadioGroup
                                             value={mesSelecionado}
                                             onValueChange={setMesSelecionado}
                                             className="flex flex-wrap gap-4"
                                           >
                                             {mesesExibidos.map((mes) => (
                                               <div key={mes} className="flex items-center space-x-2">
                                                 <RadioGroupItem value={mes} id={`mes-${mes}`} />
                                                 <Label htmlFor={`mes-${mes}`} className="text-sm font-normal">
                                                   {mes}
                                                 </Label>
                                               </div>
                                             ))}
                                           </RadioGroup>
                                         </div>

                                         {/* Detalhes do cálculo */}
                                         {mesSelecionado && (
                                           <div className="border-t pt-4 space-y-3">
                                             <div>
                                               <h4 className="font-medium text-sm mb-2">Fórmula:</h4>
                                               <p className="text-sm text-muted-foreground bg-background/50 p-3 rounded border">
                                                 {obterFormula(indicador)}
                                               </p>
                                             </div>

                                             {(() => {
                                               const detalhes = obterDetalhesCalculo(indicador, mesSelecionado)

                                               if (detalhes.erro) {
                                                 return (
                                                   <div className="text-sm text-muted-foreground bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                                                     {detalhes.erro}
                                                   </div>
                                                 )
                                               }

                                               return (
                                                 <>
                                                   <div>
                                                     <h4 className="font-medium text-sm mb-2">Valores utilizados:</h4>
                                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                       {detalhes.componentes.map((componente: any, idx: number) => (
                                                         <div key={idx} className="flex items-center justify-between text-sm bg-background/50 p-2 rounded border">
                                                           <span>
                                                             {componente.label}: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(componente.valor)}
                                                           </span>
                                                           {componente.fonte && (
                                                             <Badge variant={fonteMeta[componente.fonte].variant as any} className="ml-2 shrink-0">
                                                               {fonteMeta[componente.fonte].label}
                                                             </Badge>
                                                           )}
                                                         </div>
                                                       ))}
                                                     </div>
                                                   </div>

                                                   <div>
                                                     <h4 className="font-medium text-sm mb-2">Resultado:</h4>
                                                     <div className="text-sm font-semibold bg-primary/10 text-primary p-3 rounded border">
                                                       {formatarValor(detalhes.resultado, indicador)}
                                                     </div>
                                                   </div>
                                                 </>
                                               )
                                             })()}
                                           </div>
                                         )}
                                       </div>
                                     </TableCell>
                                   </TableRow>
                                 )}
                               </>
                             )
                           })}
                         </>
                       )
                     })}
                   </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nota explicativa */}
        {mesesExibidos.length === 0 && (
          <div className="text-center py-8">
            <div className="text-sm text-muted-foreground max-w-2xl mx-auto">
              <p>
                Selecione uma empresa e ano para visualizar os indicadores calculados automaticamente com base nos balancetes importados.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}