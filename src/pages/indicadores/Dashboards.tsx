import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Search, Filter, Download, Building2, TrendingUp, BarChart3, FileText } from "lucide-react"
import { DoughnutChart } from "./components/DoughnutChart"
import { MixedChart } from "./components/MixedChart"
import { generateDashboardPDF } from "./utils/pdfGenerator"
import InputMask from "react-input-mask"

interface Empresa {
  cnpj: string
  nome_empresarial: string
}

interface IndicadorData {
  [mes: string]: number | null
}

interface DashboardData {
  empresa: Empresa | null
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

interface CacheItem {
  data: DashboardData
  timestamp: number
}

export function Dashboards() {
  const { toast } = useToast()
  
  // Estados principais
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("")
  const [mesInicio, setMesInicio] = useState<string>("")
  const [mesFim, setMesFim] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  
  // Cache leve (em memória)
  const [cache, setCache] = useState<Map<string, CacheItem>>(new Map())
  
  // Estados dos filtros
  const [searchTerm, setSearchTerm] = useState("")
  
  // Cache key baseado nos filtros
  const cacheKey = useMemo(() => 
    `${empresaSelecionada}-${mesInicio}-${mesFim}`, 
    [empresaSelecionada, mesInicio, mesFim]
  )
  
  // Carregar empresas disponíveis
  useEffect(() => {
    carregarEmpresas()
  }, [])
  
  const carregarEmpresas = async () => {
    try {
      // Buscar CNPJs únicos que têm balancetes parametrizados
      const { data: balancetesData, error: balancetesError } = await supabase
        .from('balancetes')
        .select('cnpj')
        .in('status', ['parametrizado', 'parametrizando'])

      if (balancetesError) throw balancetesError

      const cnpjsComBalancetes = [...new Set(balancetesData?.map(b => b.cnpj) || [])]

      if (cnpjsComBalancetes.length === 0) {
        setEmpresas([])
        return
      }

      // Buscar dados das empresas
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
  
  const empresasFiltradas = useMemo(() => {
    if (!searchTerm) return empresas
    return empresas.filter(empresa => 
      empresa.nome_empresarial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      empresa.cnpj.includes(searchTerm)
    )
  }, [empresas, searchTerm])
  
  const aplicarFiltros = async () => {
    if (!empresaSelecionada || !mesInicio || !mesFim) {
      toast({
        title: "Filtros obrigatórios",
        description: "Selecione empresa, mês início e mês fim",
        variant: "destructive"
      })
      return
    }
    
    // Verificar cache primeiro
    const cachedData = cache.get(cacheKey)
    const now = Date.now()
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos
    
    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      setDashboardData(cachedData.data)
      return
    }
    
    setLoading(true)
    
    try {
      const data = await carregarDadosDashboard()
      
      // Salvar no cache
      setCache(prev => new Map(prev.set(cacheKey, {
        data,
        timestamp: now
      })))
      
      setDashboardData(data)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do dashboard",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const carregarDadosDashboard = async (): Promise<DashboardData> => {
    // Extrair ano e mês do formato MM/AAAA
    const [mesInicioMes, anoInicio] = mesInicio.split('/').map(Number)
    const [mesFimMes, anoFim] = mesFim.split('/').map(Number)
    
    // Buscar dados da empresa
    const { data: empresaData, error: empresaError } = await supabase
      .from('clients')
      .select('cnpj, nome_empresarial')
      .eq('cnpj', empresaSelecionada)
      .single()
    
    if (empresaError) throw empresaError
    
    // Buscar balancetes no período
    const { data: balancetes, error: balancetesError } = await supabase
      .from('balancetes')
      .select(`
        id, ano, mes,
        contas_balancete (
          codigo, nome, saldo_atual, saldo_anterior
        )
      `)
      .eq('cnpj', empresaSelecionada)
      .gte('ano', anoInicio)
      .lte('ano', anoFim)
      .in('status', ['parametrizado', 'parametrizando'])
      .order('ano')
      .order('mes')

    if (balancetesError) throw balancetesError

    // Buscar parametrizações
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

    // Processar dados dos indicadores
    const indicadoresData = processarIndicadores(balancetes, parametrizacoes)
    
    // Calcular dados do dashboard
    const margemLiquidaMesFim = calcularMargemLiquidaMesFim(indicadoresData, mesFimMes, anoFim)
    const margemLiquidaAcumulada = calcularMargemLiquidaAcumulada(indicadoresData, mesInicioMes, anoInicio, mesFimMes, anoFim)
    const fluxoResultados = calcularFluxoResultados(indicadoresData, mesInicioMes, anoInicio, mesFimMes, anoFim)
    const dreResumo = calcularDREResumo(balancetes, parametrizacoes, mesInicioMes, anoInicio, mesFimMes, anoFim)
    
    return {
      empresa: empresaData,
      margemLiquidaMesFim,
      margemLiquidaAcumulada,
      fluxoResultados,
      dreResumo
    }
  }
  
  const processarIndicadores = (balancetes: any[], parametrizacoes: any[]) => {
    const dadosProcessados: { [mes: string]: any } = {}
    
    // Criar mapeamento conta balancete -> plano de contas
    const mapeamento: { [codigo: string]: any } = {}
    parametrizacoes.forEach(param => {
      if (param.plano_contas) {
        mapeamento[param.conta_balancete_codigo] = param.plano_contas
      }
    })
    
    // Processar cada balancete
    balancetes.forEach(balancete => {
      const chave = `${balancete.ano}-${balancete.mes.toString().padStart(2, '0')}`
      const contasProcessadas: { [codigoPlano: string]: { saldo_atual: number, saldo_anterior: number, movimento: number } } = {}
      
      // Processar contas do balancete
      if (balancete.contas_balancete) {
        balancete.contas_balancete.forEach((conta: any) => {
          const planoContas = mapeamento[conta.codigo]
          if (planoContas) {
            const movimento = conta.saldo_atual - conta.saldo_anterior
            contasProcessadas[planoContas.codigo] = {
              saldo_atual: conta.saldo_atual,
              saldo_anterior: conta.saldo_anterior,
              movimento: movimento
            }
          }
        })
      }
      
      dadosProcessados[chave] = contasProcessadas
    })
    
    return dadosProcessados
  }
  
  const obterValorConta = (dadosMes: any, codigoGrupo: string, fonte: 'saldo_atual' | 'saldo_anterior' | 'movimento' = 'saldo_atual'): number => {
    if (!dadosMes) return 0
    
    let total = 0
    Object.entries(dadosMes).forEach(([codigo, dados]: [string, any]) => {
      if (codigo.startsWith(codigoGrupo)) {
        total += dados[fonte] || 0
      }
    })
    
    return total
  }
  
  const calcularMargemLiquidaMesFim = (dadosIndicadores: any, mes: number, ano: number): number | null => {
    const chave = `${ano}-${mes.toString().padStart(2, '0')}`
    const dadosMes = dadosIndicadores[chave]
    
    if (!dadosMes) return null
    
    const receitas = obterValorConta(dadosMes, '3', 'saldo_atual')
    const custos = obterValorConta(dadosMes, '4.1', 'saldo_atual')
    const despesas = obterValorConta(dadosMes, '4.2', 'saldo_atual')
    
    if (receitas === 0) return null
    
    // Normalizar sinais (receitas são positivas, custos e despesas são despesa)
    const receitasNorm = Math.abs(receitas)
    const custosNorm = Math.abs(custos)
    const despesasNorm = Math.abs(despesas)
    
    return ((receitasNorm - custosNorm - despesasNorm) / receitasNorm) * 100
  }
  
  const calcularMargemLiquidaAcumulada = (dadosIndicadores: any, mesInicio: number, anoInicio: number, mesFim: number, anoFim: number): number | null => {
    let receitasTotal = 0
    let custosTotal = 0
    let despesasTotal = 0
    
    // Iterar pelos meses do período
    for (let ano = anoInicio; ano <= anoFim; ano++) {
      const mesInicioAtual = ano === anoInicio ? mesInicio : 1
      const mesFimAtual = ano === anoFim ? mesFim : 12
      
      for (let mes = mesInicioAtual; mes <= mesFimAtual; mes++) {
        const chave = `${ano}-${mes.toString().padStart(2, '0')}`
        const dadosMes = dadosIndicadores[chave]
        
        if (dadosMes) {
          receitasTotal += Math.abs(obterValorConta(dadosMes, '3', 'saldo_atual'))
          custosTotal += Math.abs(obterValorConta(dadosMes, '4.1', 'saldo_atual'))
          despesasTotal += Math.abs(obterValorConta(dadosMes, '4.2', 'saldo_atual'))
        }
      }
    }
    
    if (receitasTotal === 0) return null
    
    return ((receitasTotal - custosTotal - despesasTotal) / receitasTotal) * 100
  }
  
  const calcularFluxoResultados = (dadosIndicadores: any, mesInicio: number, anoInicio: number, mesFim: number, anoFim: number) => {
    const meses: string[] = []
    const receitas: number[] = []
    const custosEDespesas: number[] = []
    const resultadoLiquido: number[] = []
    
    // Iterar pelos meses do período
    for (let ano = anoInicio; ano <= anoFim; ano++) {
      const mesInicioAtual = ano === anoInicio ? mesInicio : 1
      const mesFimAtual = ano === anoFim ? mesFim : 12
      
      for (let mes = mesInicioAtual; mes <= mesFimAtual; mes++) {
        const chave = `${ano}-${mes.toString().padStart(2, '0')}`
        const dadosMes = dadosIndicadores[chave]
        
        meses.push(`${mes.toString().padStart(2, '0')}/${ano}`)
        
        if (dadosMes) {
          const receitasMes = Math.abs(obterValorConta(dadosMes, '3', 'movimento'))
          const custosMes = Math.abs(obterValorConta(dadosMes, '4.1', 'movimento'))
          const despesasMes = Math.abs(obterValorConta(dadosMes, '4.2', 'movimento'))
          const custosEDespesasMes = custosMes + despesasMes
          const resultadoMes = receitasMes - custosEDespesasMes
          
          receitas.push(receitasMes)
          custosEDespesas.push(custosEDespesasMes)
          resultadoLiquido.push(resultadoMes)
        } else {
          receitas.push(0)
          custosEDespesas.push(0)
          resultadoLiquido.push(0)
        }
      }
    }
    
    return {
      meses,
      receitas,
      custosEDespesas,
      resultadoLiquido
    }
  }
  
  const calcularDREResumo = (balancetes: any[], parametrizacoes: any[], mesInicio: number, anoInicio: number, mesFim: number, anoFim: number) => {
    const meses: string[] = []
    const dadosProcessados = processarIndicadores(balancetes, parametrizacoes)
    
    // Estrutura da DRE
    const estruturaDRE = [
      'Receita Bruta',
      '(–) Deduções da Receita Bruta', 
      '(=) Receita Líquida',
      '(–) Custos',
      '(=) Lucro Bruto',
      '(–) Despesas',
      '(+) Outras Receitas Operacionais',
      '(=) Lucro Líquido'
    ]
    
    const data: { [linha: string]: number[] } = {}
    estruturaDRE.forEach(linha => {
      data[linha] = []
    })
    
    // Iterar pelos meses do período
    for (let ano = anoInicio; ano <= anoFim; ano++) {
      const mesInicioAtual = ano === anoInicio ? mesInicio : 1
      const mesFimAtual = ano === anoFim ? mesFim : 12
      
      for (let mes = mesInicioAtual; mes <= mesFimAtual; mes++) {
        const chave = `${ano}-${mes.toString().padStart(2, '0')}`
        const dadosMes = dadosProcessados[chave]
        
        meses.push(`${mes.toString().padStart(2, '0')}/${ano}`)
        
        if (dadosMes) {
          const receitaBruta = Math.abs(obterValorConta(dadosMes, '3.1.1', 'movimento'))
          const deducoes = Math.abs(obterValorConta(dadosMes, '3.1.2', 'movimento'))
          const receitaLiquida = receitaBruta - deducoes
          const custos = Math.abs(obterValorConta(dadosMes, '4.1', 'movimento'))
          const lucroBruto = receitaLiquida - custos
          const despesas = Math.abs(obterValorConta(dadosMes, '4.2', 'movimento'))
          const outrasReceitas = Math.abs(obterValorConta(dadosMes, '3.1.3', 'movimento'))
          const lucroLiquido = lucroBruto - despesas + outrasReceitas
          
          data['Receita Bruta'].push(receitaBruta)
          data['(–) Deduções da Receita Bruta'].push(deducoes)
          data['(=) Receita Líquida'].push(receitaLiquida)
          data['(–) Custos'].push(custos)
          data['(=) Lucro Bruto'].push(lucroBruto)
          data['(–) Despesas'].push(despesas)
          data['(+) Outras Receitas Operacionais'].push(outrasReceitas)
          data['(=) Lucro Líquido'].push(lucroLiquido)
        } else {
          estruturaDRE.forEach(linha => {
            data[linha].push(0)
          })
        }
      }
    }
    
    return {
      meses,
      data
    }
  }
  
  const imprimirPDF = () => {
    if (!dashboardData) return
    
    generateDashboardPDF({
      empresa: dashboardData.empresa!,
      periodo: `${mesInicio} a ${mesFim}`,
      margemLiquidaMesFim: dashboardData.margemLiquidaMesFim,
      margemLiquidaAcumulada: dashboardData.margemLiquidaAcumulada,
      fluxoResultados: dashboardData.fluxoResultados,
      dreResumo: dashboardData.dreResumo
    })
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboards</h1>
          <p className="text-muted-foreground">
            Visualize indicadores financeiros e contábeis
          </p>
        </div>
        {dashboardData && (
          <Button onClick={imprimirPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Imprimir PDF
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar empresa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  {empresasFiltradas.map((empresa) => (
                    <SelectItem key={empresa.cnpj} value={empresa.cnpj}>
                      {empresa.nome_empresarial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mesInicio">Mês Início (MM/AAAA)</Label>
              <InputMask
                mask="99/9999"
                value={mesInicio}
                onChange={(e) => setMesInicio(e.target.value)}
              >
                {(inputProps) => (
                  <Input
                    {...inputProps}
                    id="mesInicio"
                    placeholder="01/2024"
                  />
                )}
              </InputMask>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mesFim">Mês Fim (MM/AAAA)</Label>
              <InputMask
                mask="99/9999"
                value={mesFim}
                onChange={(e) => setMesFim(e.target.value)}
              >
                {(inputProps) => (
                  <Input
                    {...inputProps}
                    id="mesFim"
                    placeholder="12/2024"
                  />
                )}
              </InputMask>
            </div>
            
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={aplicarFiltros} className="w-full" disabled={loading}>
                {loading ? "Carregando..." : "Aplicar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card da Empresa */}
      {dashboardData && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h3 className="text-xl font-semibold">{dashboardData.empresa?.nome_empresarial}</h3>
                <p className="text-sm text-muted-foreground">CNPJ: {dashboardData.empresa?.cnpj}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo Principal */}
      {!dashboardData && !loading && (
        <Card className="py-12">
          <CardContent className="text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum dado para exibir</h3>
            <p className="text-muted-foreground">
              Aplique os filtros acima para carregar os dados do dashboard
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64" />
              </CardContent>
            </Card>
          </div>
          <Skeleton className="h-96" />
        </div>
      )}

      {dashboardData && (
        <Tabs defaultValue="resumo" className="space-y-6">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
          </TabsList>
          
          <TabsContent value="resumo" className="space-y-6">
            {/* Gráficos de Lucratividade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Lucratividade (Mês Fim)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DoughnutChart
                    data={dashboardData.margemLiquidaMesFim}
                    label="Margem Líquida (%)"
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Lucratividade Acumulada (Período)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DoughnutChart
                    data={dashboardData.margemLiquidaAcumulada}
                    label="Margem Líquida Acumulada (%)"
                  />
                </CardContent>
              </Card>
            </div>
            
            {/* Fluxo de Resultados */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Fluxo de Resultados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MixedChart data={dashboardData.fluxoResultados} />
              </CardContent>
            </Card>
            
            {/* DRE Resumida */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  DRE Resumida
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">Conta</TableHead>
                        {dashboardData.dreResumo.meses.map(mes => (
                          <TableHead key={mes} className="text-right">{mes}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(dashboardData.dreResumo.data).map(([linha, valores]) => (
                        <TableRow key={linha}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {linha}
                          </TableCell>
                          {valores.map((valor, index) => (
                            <TableCell key={index} className="text-right">
                              {valor !== null ? (
                                typeof valor === 'number' ? 
                                valor.toLocaleString('pt-BR', { 
                                  style: 'currency', 
                                  currency: 'BRL' 
                                }) : valor
                              ) : '–'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}