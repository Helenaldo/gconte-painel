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

      // Processar dados por mês
      const dadosPorMes: { [mes: number]: { [grupo: string]: number } } = {}
      const mesesComDados: number[] = []

      balancetes.forEach(balancete => {
        if (!dadosPorMes[balancete.mes]) {
          dadosPorMes[balancete.mes] = {}
          mesesComDados.push(balancete.mes)
        }

        balancete.contas_balancete?.forEach(conta => {
          const planoContas = mapaParametrizacoes.get(conta.codigo)
          if (planoContas) {
            const grupo = planoContas.grupo
            if (!dadosPorMes[balancete.mes][grupo]) {
              dadosPorMes[balancete.mes][grupo] = 0
            }
            dadosPorMes[balancete.mes][grupo] += parseFloat(conta.saldo_atual.toString()) || 0
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

        // Obter valores dos grupos
        const ativoCirculante = dados['ativo_circulante'] || 0
        const ativoNaoCirculante = dados['ativo_nao_circulante'] || 0
        const ativoTotal = ativoCirculante + ativoNaoCirculante
        const passivoCirculante = dados['passivo_circulante'] || 0
        const passivoNaoCirculante = dados['passivo_nao_circulante'] || 0
        const passivoTotal = passivoCirculante + passivoNaoCirculante
        const patrimonioLiquido = dados['patrimonio_liquido'] || 0
        const estoques = dados['estoques'] || 0
        const realizavelLongoPrazo = dados['realizavel_longo_prazo'] || 0
        const imobilizado = dados['imobilizado'] || 0
        const receitas = dados['receitas'] || 0
        const custos = dados['custos'] || 0
        const despesas = dados['despesas'] || 0

        // Calcular indicadores
        if (passivoCirculante > 0) {
          resultadosIndicadores["Liquidez Corrente"][mesNome] = ativoCirculante / passivoCirculante
          resultadosIndicadores["Liquidez Seca"][mesNome] = (ativoCirculante - estoques) / passivoCirculante
        }

        if (passivoCirculante + passivoNaoCirculante > 0) {
          resultadosIndicadores["Liquidez Geral"][mesNome] = (ativoCirculante + realizavelLongoPrazo) / (passivoCirculante + passivoNaoCirculante)
        }

        if (patrimonioLiquido > 0) {
          resultadosIndicadores["Participação de Capitais de Terceiros (PCT)"][mesNome] = passivoTotal / patrimonioLiquido
          resultadosIndicadores["Imobilização do Patrimônio Líquido (IPL)"][mesNome] = imobilizado / patrimonioLiquido
        }

        if (passivoTotal > 0) {
          resultadosIndicadores["Composição do Endividamento (CE)"][mesNome] = passivoCirculante / passivoTotal
        }

        if (receitas > 0) {
          const lucoBruto = receitas - custos
          resultadosIndicadores["Margem Bruta (%)"][mesNome] = (lucoBruto / receitas) * 100
          
          const lucroLiquido = receitas - custos - despesas
          resultadosIndicadores["Margem Líquida (%)"][mesNome] = (lucroLiquido / receitas) * 100
        }

        if (ativoTotal > 0 && receitas > 0) {
          resultadosIndicadores["Giro do Ativo"][mesNome] = receitas / ativoTotal
        }

        // Capital Circulante Líquido
        resultadosIndicadores["Capital Circulante Líquido (CCL)"][mesNome] = ativoCirculante - passivoCirculante
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
      "Participação de Capitais de Terceiros (PCT)": "Passivo Total ÷ Patrimônio Líquido",
      "Composição do Endividamento (CE)": "Passivo Circulante ÷ Passivo Total",
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

    const ativoCirculante = dados['ativo_circulante'] || 0
    const ativoNaoCirculante = dados['ativo_nao_circulante'] || 0
    const ativoTotal = ativoCirculante + ativoNaoCirculante
    const passivoCirculante = dados['passivo_circulante'] || 0
    const passivoNaoCirculante = dados['passivo_nao_circulante'] || 0
    const passivoTotal = passivoCirculante + passivoNaoCirculante
    const patrimonioLiquido = dados['patrimonio_liquido'] || 0
    const estoques = dados['estoques'] || 0
    const realizavelLongoPrazo = dados['realizavel_longo_prazo'] || 0
    const imobilizado = dados['imobilizado'] || 0
    const receitas = dados['receitas'] || 0
    const custos = dados['custos'] || 0
    const despesas = dados['despesas'] || 0

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
            `Passivo Total: ${formatarMoeda(passivoTotal)}`,
            `Patrimônio Líquido: ${formatarMoeda(patrimonioLiquido)}`
          ],
          resultado: patrimonioLiquido > 0 ? passivoTotal / patrimonioLiquido : null
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
                               <span>{indicador}</span>
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