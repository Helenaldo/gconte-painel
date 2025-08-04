import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Search, Calculator } from "lucide-react"

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
      const { data, error } = await supabase
        .from('clients')
        .select('cnpj, nome_empresarial')
        .order('nome_empresarial')

      if (error) throw error

      setEmpresas(data || [])
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
        .eq('status', 'parametrizado')
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
      // Buscar balancetes parametrizados da empresa no ano selecionado
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
        .eq('status', 'parametrizado')
        .order('mes')

      if (balancetesError) throw balancetesError

      if (!balancetes || balancetes.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "Nenhum balancete parametrizado encontrado para os filtros selecionados",
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

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Cabeçalho */}
      <div className="flex flex-col space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Indicadores Contábeis e Financeiros</h1>
          <p className="text-muted-foreground">
            Análise comparativa dos principais indicadores empresariais
          </p>
        </div>
        
        {/* Filtros */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                <SelectTrigger>
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
                <SelectTrigger>
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

            <Button 
              onClick={calcularIndicadores} 
              disabled={loading || !empresaSelecionada || !anoSelecionado}
              className="w-full"
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
        </Card>
      </div>

      {/* Tabela de Indicadores */}
      <Card className="w-[95vw] max-w-[95vw] mx-auto">
        <CardHeader>
          <CardTitle>Tabela de Indicadores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
            {/* Container com scroll horizontal */}
            <div className="overflow-x-auto">
              <Table className="relative">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {/* Primeira coluna fixa - Indicadores */}
                    <TableHead className="sticky left-0 bg-background z-20 min-w-[280px] border-r font-semibold">
                      Indicador
                    </TableHead>
                    {/* Colunas dos meses */}
                    {mesesExibidos.map((mes) => (
                      <TableHead 
                        key={mes} 
                        className="text-center min-w-[120px] font-semibold"
                      >
                        {mes}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nomeIndicadores.map((indicador, index) => (
                    <TableRow 
                      key={indicador}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                    >
                      {/* Primeira coluna fixa - Nome do indicador */}
                      <TableCell className="sticky left-0 bg-inherit z-10 border-r font-medium">
                        {indicador}
                      </TableCell>
                      {/* Células dos meses com valores calculados */}
                      {mesesExibidos.map((mes) => (
                        <TableCell 
                          key={mes} 
                          className="text-center"
                        >
                          {formatarValor(indicadores[indicador]?.[mes] || null, indicador)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nota explicativa */}
      {mesesExibidos.length === 0 && (
        <div className="text-sm text-muted-foreground text-center max-w-4xl mx-auto">
          <p>
            Selecione uma empresa e ano para visualizar os indicadores calculados automaticamente com base nos balancetes parametrizados.
          </p>
        </div>
      )}
    </div>
  )
}