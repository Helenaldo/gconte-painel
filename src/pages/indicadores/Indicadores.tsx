import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Search, Calculator, ChevronDown, ChevronRight } from "lucide-react"

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
  const [indicadores, setIndicadores] = useState<{ [nome: string]: IndicadorData }>({})
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([])
  const [mesesExibidos, setMesesExibidos] = useState<string[]>([])
  const [indicadorExpandido, setIndicadorExpandido] = useState<string | null>(null)
  const [mesSelecionado, setMesSelecionado] = useState<string>("")
  const [dadosDetalhados, setDadosDetalhados] = useState<{ [mes: number]: { [grupo: string]: number } }>({})

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
    "Giro do Ativo",
    "Capital Circulante Líquido (CCL)"
  ]

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
      // Buscar todas as empresas
      const { data: empresasData, error: empresasError } = await supabase
        .from('clients')
        .select('cnpj, nome_empresarial')
        .order('nome_empresarial')

      if (empresasError) throw empresasError

      // Filtrar apenas empresas que têm balancetes
      const empresasComBalancetes: Empresa[] = []
      for (const empresa of empresasData || []) {
        const { data: balancetes } = await supabase
          .from('balancetes')
          .select('id')
          .eq('cnpj', empresa.cnpj)
          .limit(1)

        if (balancetes && balancetes.length > 0) {
          empresasComBalancetes.push(empresa)
        }
      }
      setEmpresas(empresasComBalancetes)
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

  const calcularIndicadores = async () => {
    if (!empresaSelecionada || !anoSelecionado) {
      toast({
        title: "Filtros obrigatórios",
        description: "Selecione empresa e ano para calcular os indicadores",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      // Buscar balancetes da empresa no ano selecionado (incluindo parametrizando)
      const { data: balancetes, error: balancetesError } = await supabase
        .from('balancetes')
        .select(`
          id, ano, mes,
          contas_balancete (
            codigo, nome, saldo_atual
          )
        `)
        .eq('cnpj', empresaSelecionada)
        .eq('ano', parseInt(anoSelecionado))
        .in('status', ['parametrizado', 'parametrizando'])
        .order('mes')

      if (balancetesError) throw balancetesError

      if (!balancetes || balancetes.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "Nenhum balancete encontrado para os filtros selecionados",
          variant: "destructive"
        })
        setIndicadores({})
        setMesesExibidos([])
        return
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
      const dadosPorMes: { [mes: number]: { [codigoPlano: string]: number } } = {}
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
              dadosPorMes[balancete.mes][codigoPlano] = 0
            }
            dadosPorMes[balancete.mes][codigoPlano] += parseFloat(conta.saldo_atual.toString()) || 0
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

        // Função para obter valor de conta do Plano de Contas Padrão - usar conta específica ou somar filhas
        const obterValorConta = (codigo: string): number => {
          // Se a conta específica existe, usar seu valor (já consolidado)
          if (dados[codigo] !== undefined) {
            return dados[codigo]
          }
          
          // Se não existe, somar apenas contas filhas diretas (próximo nível)
          let total = 0
          const proximoNivel = codigo + '.'
          for (const [codigoConta, valor] of Object.entries(dados)) {
            // Verificar se é uma conta filha direta (não incluir netos)
            if (codigoConta.startsWith(proximoNivel)) {
              const parteFilha = codigoConta.substring(proximoNivel.length)
              // Se não tem mais pontos, é filha direta
              if (!parteFilha.includes('.')) {
                total += valor
              }
            }
          }
          return total
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
        const imobilizado = obterValorConta('1.2.2')  // 1.2.2 - Imobilizado
        const receitas = obterValorConta('3.1')  // 3.1 - Receitas
        const custos = obterValorConta('3.2')  // 3.2 - Custos
        const despesas = obterValorConta('4.')  // 4. - Despesas

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
        if (temContasParametrizadas('1.1') && temContasParametrizadas('2.1') && passivoCirculante !== 0) {
          resultadosIndicadores["Liquidez Corrente"][mesNome] = ativoCirculante / passivoCirculante
        } else {
          resultadosIndicadores["Liquidez Corrente"][mesNome] = null
        }

        // Liquidez Seca: precisa de Ativo Circulante e Passivo Circulante parametrizados
        if (temContasParametrizadas('1.1') && temContasParametrizadas('2.1') && passivoCirculante !== 0) {
          resultadosIndicadores["Liquidez Seca"][mesNome] = (ativoCirculante - estoques) / passivoCirculante
        } else {
          resultadosIndicadores["Liquidez Seca"][mesNome] = null
        }

        // Liquidez Geral: precisa de Ativo Circulante, Passivo Circulante e Não Circulante
        if (temContasParametrizadas('1.1') && temContasParametrizadas('2.1') && temContasParametrizadas('2.2') && 
            (passivoCirculante + passivoNaoCirculante) !== 0) {
          resultadosIndicadores["Liquidez Geral"][mesNome] = (ativoCirculante + realizavelLongoPrazo) / (passivoCirculante + passivoNaoCirculante)
        } else {
          resultadosIndicadores["Liquidez Geral"][mesNome] = null
        }

        // PCT: precisa de Passivo (2.1 e 2.2) e Patrimônio Líquido (2.3) parametrizados
        if (temContasParametrizadas('2.1') && temContasParametrizadas('2.2') && 
            temContasParametrizadas('2.3') && patrimonioLiquido !== 0) {
          resultadosIndicadores["Participação de Capitais de Terceiros (PCT)"][mesNome] = (passivoCirculante + passivoNaoCirculante) / patrimonioLiquido
        } else {
          resultadosIndicadores["Participação de Capitais de Terceiros (PCT)"][mesNome] = null
        }

        // IPL: precisa de Imobilizado (1.2.2) e Patrimônio Líquido (2.3) parametrizados
        if (temContasParametrizadas('1.2.2') && temContasParametrizadas('2.3') && patrimonioLiquido !== 0) {
          resultadosIndicadores["Imobilização do Patrimônio Líquido (IPL)"][mesNome] = imobilizado / patrimonioLiquido
        } else {
          resultadosIndicadores["Imobilização do Patrimônio Líquido (IPL)"][mesNome] = null
        }

        // CE: precisa de Passivo Circulante (2.1) e Passivo Não Circulante (2.2) parametrizados
        if (temContasParametrizadas('2.1') && temContasParametrizadas('2.2') && (passivoCirculante + passivoNaoCirculante) !== 0) {
          resultadosIndicadores["Composição do Endividamento (CE)"][mesNome] = passivoCirculante / (passivoCirculante + passivoNaoCirculante)
        } else {
          resultadosIndicadores["Composição do Endividamento (CE)"][mesNome] = null
        }

        // Margem Bruta: precisa de Receitas (3.1) parametrizadas
        if (temContasParametrizadas('3.1') && receitas !== 0) {
          const lucoBruto = receitas - custos
          resultadosIndicadores["Margem Bruta (%)"][mesNome] = (lucoBruto / receitas) * 100
        } else {
          resultadosIndicadores["Margem Bruta (%)"][mesNome] = null
        }

        // Margem Líquida: precisa de Receitas (3.1) parametrizadas
        if (temContasParametrizadas('3.1') && receitas !== 0) {
          const lucroLiquido = receitas - custos - despesas
          resultadosIndicadores["Margem Líquida (%)"][mesNome] = (lucroLiquido / receitas) * 100
        } else {
          resultadosIndicadores["Margem Líquida (%)"][mesNome] = null
        }

        // Giro do Ativo: precisa de Receitas (3.1) e Ativo Total (1.1 + 1.2) parametrizados
        if (temContasParametrizadas('3.1') && temContasParametrizadas('1.1') && 
            temContasParametrizadas('1.2') && ativoTotal !== 0 && receitas !== 0) {
          resultadosIndicadores["Giro do Ativo"][mesNome] = receitas / ativoTotal
        } else {
          resultadosIndicadores["Giro do Ativo"][mesNome] = null
        }

        // Capital Circulante Líquido: precisa de Ativo Circulante (1.1) e Passivo Circulante (2.1) parametrizados
        if (temContasParametrizadas('1.1') && temContasParametrizadas('2.1')) {
          resultadosIndicadores["Capital Circulante Líquido (CCL)"][mesNome] = ativoCirculante - passivoCirculante
        } else {
          resultadosIndicadores["Capital Circulante Líquido (CCL)"][mesNome] = null
        }
      })

      setIndicadores(resultadosIndicadores)
      setDadosDetalhados(dadosPorMes)
      
      // Definir mês mais recente como padrão
      if (mesesOrdenados.length > 0) {
        const mesRecente = nomesMeses[mesesOrdenados[mesesOrdenados.length - 1] - 1]
        setMesSelecionado(mesRecente)
      }

    } catch (error) {
      console.error('Erro ao calcular indicadores:', error)
      toast({
        title: "Erro",
        description: "Falha ao calcular indicadores",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const formatarValor = (valor: number | null, indicador: string): string => {
    if (valor === null || valor === undefined) return "–"
    
    if (indicador.includes("(%)")) {
      return `${valor.toFixed(2)}%`
    } else if (indicador.includes("CCL")) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(valor)
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
      "Imobilização do Patrimônio Líquido (IPL)": "Imobilizado ÷ Patrimônio Líquido",
      "Margem Bruta (%)": "(Lucro Bruto ÷ Receita Líquida) × 100",
      "Margem Líquida (%)": "(Lucro Líquido ÷ Receita Líquida) × 100",
      "Giro do Ativo": "Receita Líquida ÷ Ativo Total",
      "Capital Circulante Líquido (CCL)": "Ativo Circulante – Passivo Circulante"
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

    // Função para obter valor de conta do Plano de Contas Padrão - usar conta específica ou somar filhas
    const obterValorConta = (codigo: string): number => {
      // Se a conta específica existe, usar seu valor (já consolidado)
      if (dados[codigo] !== undefined) {
        return dados[codigo]
      }
      
      // Se não existe, somar apenas contas filhas diretas (próximo nível)
      let total = 0
      const proximoNivel = codigo + '.'
      for (const [codigoConta, valor] of Object.entries(dados)) {
        // Verificar se é uma conta filha direta (não incluir netos)
        if (codigoConta.startsWith(proximoNivel)) {
          const parteFilha = codigoConta.substring(proximoNivel.length)
          // Se não tem mais pontos, é filha direta
          if (!parteFilha.includes('.')) {
            total += valor
          }
        }
      }
      return total
    }

    // Calcular valores usando APENAS contas parametrizadas do Plano de Contas Padrão (sem dupla contagem)
    const ativoCirculante = obterValorConta('1.1')  // 1.1 - Ativo Circulante
    const ativoNaoCirculante = obterValorConta('1.2')  // 1.2 - Ativo Não Circulante
    const ativoTotal = ativoCirculante + ativoNaoCirculante
    const passivoCirculante = obterValorConta('2.1')  // 2.1 - Passivo Circulante
    const passivoNaoCirculante = obterValorConta('2.2')  // 2.2 - Passivo Não Circulante
    const passivoTotal = passivoCirculante + passivoNaoCirculante
    const patrimonioLiquido = obterValorConta('2.3')  // 2.3 - Patrimônio Líquido
    const estoques = obterValorConta('1.1.4')  // 1.1.4 - Estoques
    const realizavelLongoPrazo = obterValorConta('1.2.1')  // 1.2.1 - Realizável a Longo Prazo
    const imobilizado = obterValorConta('1.2.2')  // 1.2.2 - Imobilizado
    const receitas = obterValorConta('3.1')  // 3.1 - Receitas
    const custos = obterValorConta('3.2')  // 3.2 - Custos
    const despesas = obterValorConta('4.')  // 4. - Despesas

    switch (indicador) {
      case "Liquidez Corrente":
        return {
          componentes: [
            `Ativo Circulante: ${formatarMoeda(ativoCirculante)}`,
            `Passivo Circulante: ${formatarMoeda(passivoCirculante)}`
          ],
          resultado: passivoCirculante > 0 ? ativoCirculante / passivoCirculante : null
        }
      
      case "Liquidez Seca":
        return {
          componentes: [
            `Ativo Circulante: ${formatarMoeda(ativoCirculante)}`,
            `Estoques: ${formatarMoeda(estoques)}`,
            `Passivo Circulante: ${formatarMoeda(passivoCirculante)}`
          ],
          resultado: passivoCirculante > 0 ? (ativoCirculante - estoques) / passivoCirculante : null
        }
      
      case "Liquidez Geral":
        return {
          componentes: [
            `Ativo Circulante: ${formatarMoeda(ativoCirculante)}`,
            `Realizável a Longo Prazo: ${formatarMoeda(realizavelLongoPrazo)}`,
            `Passivo Circulante: ${formatarMoeda(passivoCirculante)}`,
            `Exigível a Longo Prazo: ${formatarMoeda(passivoNaoCirculante)}`
          ],
          resultado: (passivoCirculante + passivoNaoCirculante) > 0 ? (ativoCirculante + realizavelLongoPrazo) / (passivoCirculante + passivoNaoCirculante) : null
        }
      
      case "Participação de Capitais de Terceiros (PCT)":
        return {
          componentes: [
            `Passivo Circulante: ${formatarMoeda(passivoCirculante)}`,
            `Passivo Não Circulante: ${formatarMoeda(passivoNaoCirculante)}`,
            `Patrimônio Líquido: ${formatarMoeda(patrimonioLiquido)}`
          ],
          resultado: patrimonioLiquido > 0 ? (passivoCirculante + passivoNaoCirculante) / patrimonioLiquido : null
        }
      
      case "Composição do Endividamento (CE)":
        return {
          componentes: [
            `Passivo Circulante: ${formatarMoeda(passivoCirculante)}`,
            `Passivo Total: ${formatarMoeda(passivoTotal)}`
          ],
          resultado: passivoTotal > 0 ? passivoCirculante / passivoTotal : null
        }
      
      case "Imobilização do Patrimônio Líquido (IPL)":
        return {
          componentes: [
            `Imobilizado: ${formatarMoeda(imobilizado)}`,
            `Patrimônio Líquido: ${formatarMoeda(patrimonioLiquido)}`
          ],
          resultado: patrimonioLiquido > 0 ? imobilizado / patrimonioLiquido : null
        }
      
      case "Margem Bruta (%)":
        const lucoBruto = receitas - custos
        return {
          componentes: [
            `Receitas: ${formatarMoeda(receitas)}`,
            `Custos: ${formatarMoeda(custos)}`,
            `Lucro Bruto: ${formatarMoeda(lucoBruto)}`
          ],
          resultado: receitas > 0 ? (lucoBruto / receitas) * 100 : null
        }
      
      case "Margem Líquida (%)":
        const lucroLiquido = receitas - custos - despesas
        return {
          componentes: [
            `Receitas: ${formatarMoeda(receitas)}`,
            `Custos: ${formatarMoeda(custos)}`,
            `Despesas: ${formatarMoeda(despesas)}`,
            `Lucro Líquido: ${formatarMoeda(lucroLiquido)}`
          ],
          resultado: receitas > 0 ? (lucroLiquido / receitas) * 100 : null
        }
      
      case "Giro do Ativo":
        return {
          componentes: [
            `Receitas: ${formatarMoeda(receitas)}`,
            `Ativo Total: ${formatarMoeda(ativoTotal)}`
          ],
          resultado: ativoTotal > 0 && receitas > 0 ? receitas / ativoTotal : null
        }
      
      case "Capital Circulante Líquido (CCL)":
        return {
          componentes: [
            `Ativo Circulante: ${formatarMoeda(ativoCirculante)}`,
            `Passivo Circulante: ${formatarMoeda(passivoCirculante)}`
          ],
          resultado: ativoCirculante - passivoCirculante
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

                <div className="sm:col-span-2 lg:col-span-1">
                  <Button 
                    onClick={calcularIndicadores} 
                    disabled={loading || !empresaSelecionada || !anoSelecionado}
                    className="w-full h-10"
                  >
                    {loading ? (
                      <>
                        <Search className="w-4 h-4 mr-2 animate-spin" />
                        Calculando...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-4 h-4 mr-2" />
                        Filtrar Indicadores
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
                     {nomeIndicadores.map((indicador, index) => (
                       <>
                         <TableRow 
                           key={indicador}
                           className={index % 2 === 0 ? "bg-background hover:bg-muted/50" : "bg-muted/30 hover:bg-muted/60"}
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
                                <div className="flex flex-col">
                                  <span>{indicador}</span>
                                  {indicador === "Participação de Capitais de Terceiros (PCT)" && (
                                    <span className="text-xs text-muted-foreground">Grau de Endividamento</span>
                                  )}
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
                           <TableRow>
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
                                               {detalhes.componentes.map((componente, idx) => (
                                                 <div key={idx} className="text-sm bg-background/50 p-2 rounded border">
                                                   {componente}
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
                     ))}
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