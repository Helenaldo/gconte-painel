import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Search, Filter, Download, Building2, TrendingUp, BarChart3, FileText, Maximize2 } from "lucide-react"
import { DoughnutChart } from "./components/DoughnutChart"
import { MixedChart } from "./components/MixedChart"
import { BarChart } from "./components/BarChart"
import { LineChart } from "./components/LineChart"
import { AreaChart } from "./components/AreaChart"
import { PesoChart } from "./components/PesoChart"
import { generateDashboardPDF } from "./utils/pdfGenerator"
import InputMask from "react-input-mask"
import { useAuth } from "@/context/auth-context"

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
  receitaOperacionalBruta: {
    meses: string[]
    valores: number[]
  }
  liquidezCorrente: {
    meses: string[]
    valores: number[]
  }
  capitalCirculanteLiquido: {
    meses: string[]
    valores: number[]
  }
  custosPesoReceita: {
    meses: string[]
    valoresAbsolutos: number[]
    valoresPercentuais: number[]
    labelAbsoluto: string
    labelPercentual: string
  }
  despesasPesoReceita: {
    meses: string[]
    valoresAbsolutos: number[]
    valoresPercentuais: number[]
    labelAbsoluto: string
    labelPercentual: string
  }
  tributosPesoReceita: {
    meses: string[]
    valoresAbsolutos: number[]
    valoresPercentuais: number[]
    labelAbsoluto: string
    labelPercentual: string
  }
  folhaPesoReceita: {
    meses: string[]
    valoresAbsolutos: number[]
    valoresPercentuais: number[]
    labelAbsoluto: string
    labelPercentual: string
  }
}

interface CacheItem {
  data: DashboardData
  timestamp: number
}

interface SavedFilters {
  empresaSelecionada: string
  mesInicio: string
  mesFim: string
  timestamp: number
}

interface PersistentCacheItem extends CacheItem {
  filters: SavedFilters
}

export function Dashboards() {
  const { toast } = useToast()
  const { user } = useAuth()
  
  // Estados principais
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("")
  const [mesInicio, setMesInicio] = useState<string>("")
  const [mesFim, setMesFim] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [fullscreenChart, setFullscreenChart] = useState<{type: string, data: any, title: string} | null>(null)
  const [semDados, setSemDados] = useState<boolean>(false)
  
  // Cache leve (em memória) e persistente
  const [cache, setCache] = useState<Map<string, CacheItem>>(new Map())
  
  // Estados dos filtros
  const [searchTerm, setSearchTerm] = useState("")
  
  // Cache key baseado nos filtros
  const cacheKey = useMemo(() => 
    `${empresaSelecionada}-${mesInicio}-${mesFim}`, 
    [empresaSelecionada, mesInicio, mesFim]
  )
  
  // Chaves para localStorage
  const FILTERS_KEY = 'dashboards_filters'
  const CACHE_KEY = 'dashboards_cache'
  
  // Funções utilitárias para localStorage
  const saveFiltersToStorage = (filters: SavedFilters) => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
    } catch (error) {
      console.error('Erro ao salvar filtros:', error)
    }
  }
  
  const loadFiltersFromStorage = (): SavedFilters | null => {
    try {
      const stored = localStorage.getItem(FILTERS_KEY)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('Erro ao carregar filtros:', error)
      return null
    }
  }
  
  const saveCacheToStorage = (key: string, cacheItem: PersistentCacheItem) => {
    try {
      const allCache = loadAllCacheFromStorage()
      allCache[key] = cacheItem
      localStorage.setItem(CACHE_KEY, JSON.stringify(allCache))
    } catch (error) {
      console.error('Erro ao salvar cache:', error)
    }
  }
  
  const loadAllCacheFromStorage = (): { [key: string]: PersistentCacheItem } => {
    try {
      const stored = localStorage.getItem(CACHE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('Erro ao carregar cache:', error)
      return {}
    }
  }
  
  const clearAllStorage = () => {
    try {
      localStorage.removeItem(FILTERS_KEY)
      localStorage.removeItem(CACHE_KEY)
      setCache(new Map())
      // Reset form states
      setEmpresaSelecionada("")
      setMesInicio("")
      setMesFim("")
      setDashboardData(null)
      toast({
        title: "Cache limpo",
        description: "Todos os dados em cache foram removidos",
      })
    } catch (error) {
      console.error('Erro ao limpar storage:', error)
    }
  }
  
  // Carregar empresas disponíveis e filtros salvos
  useEffect(() => {
    carregarEmpresas()
    carregarFiltrosSalvos()
    carregarCachePersistente()
  }, [])
  
  // Monitorar mudanças no usuário para limpeza do cache
  useEffect(() => {
    if (!user) {
      clearAllStorage()
    }
  }, [user])
  
  const carregarFiltrosSalvos = () => {
    const savedFilters = loadFiltersFromStorage()
    if (savedFilters && user) {
      // Verificar se os filtros não são muito antigos (24 horas)
      const isExpired = Date.now() - savedFilters.timestamp > 24 * 60 * 60 * 1000
      
      if (!isExpired) {
        setEmpresaSelecionada(savedFilters.empresaSelecionada || "")
        setMesInicio(savedFilters.mesInicio || "")
        setMesFim(savedFilters.mesFim || "")
      }
    }
  }
  
  const carregarCachePersistente = () => {
    const allCache = loadAllCacheFromStorage()
    const newCache = new Map<string, CacheItem>()
    
    Object.entries(allCache).forEach(([key, item]) => {
      // Verificar se o cache não expirou (15 minutos)
      const isExpired = Date.now() - item.timestamp > 15 * 60 * 1000
      
      if (!isExpired && user) {
        newCache.set(key, {
          data: item.data,
          timestamp: item.timestamp
        })
      }
    })
    
    setCache(newCache)
  }
  
  const buscarPeriodoDisponivel = async (cnpj: string) => {
    try {
      const { data: balancetes, error } = await supabase
        .from('balancetes')
        .select('ano, mes')
        .eq('cnpj', cnpj)
        .in('status', ['parametrizado', 'parametrizando'])
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })

      if (error) throw error

      if (!balancetes || balancetes.length === 0) {
        return null
      }

      // Encontrar o período mais recente
      const maisRecente = balancetes[0]
      const mesFim = `${maisRecente.mes.toString().padStart(2, '0')}/${maisRecente.ano}`
      
      // Calcular 6 meses antes
      let mesInicio = maisRecente.mes - 5
      let anoInicio = maisRecente.ano
      
      if (mesInicio <= 0) {
        mesInicio += 12
        anoInicio -= 1
      }
      
      const mesInicioFormatted = `${mesInicio.toString().padStart(2, '0')}/${anoInicio}`

      return { mesInicio: mesInicioFormatted, mesFim }
    } catch (error) {
      console.error('Erro ao buscar período disponível:', error)
      return null
    }
  }

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

  const handleEmpresaChange = async (cnpj: string) => {
    setEmpresaSelecionada(cnpj)
    setSemDados(false)
    
    if (cnpj) {
      const periodo = await buscarPeriodoDisponivel(cnpj)
      if (periodo) {
        setMesInicio(periodo.mesInicio)
        setMesFim(periodo.mesFim)
      } else {
        setMesInicio("")
        setMesFim("")
        toast({
          title: "Aviso",
          description: "Nenhum balancete encontrado para esta empresa",
          variant: "destructive"
        })
      }
    } else {
      setMesInicio("")
      setMesFim("")
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

    // Verificar se existem balancetes para o período específico
    const [mesInicioMes, anoInicio] = mesInicio.split('/').map(Number)
    const [mesFimMes, anoFim] = mesFim.split('/').map(Number)

    // Gerar todos os meses no período solicitado
    const mesesSolicitados = []
    let currentYear = anoInicio
    let currentMonth = mesInicioMes

    while (currentYear < anoFim || (currentYear === anoFim && currentMonth <= mesFimMes)) {
      mesesSolicitados.push({ ano: currentYear, mes: currentMonth })
      currentMonth++
      if (currentMonth > 12) {
        currentMonth = 1
        currentYear++
      }
    }

    // Verificar se existem balancetes para pelo menos um dos meses solicitados
    const verificacoesPromises = mesesSolicitados.map(({ ano, mes }) =>
      supabase
        .from('balancetes')
        .select('id')
        .eq('cnpj', empresaSelecionada)
        .eq('ano', ano)
        .eq('mes', mes)
        .in('status', ['parametrizado', 'parametrizando'])
        .limit(1)
    )

    try {
      const resultados = await Promise.all(verificacoesPromises)
      const temDados = resultados.some(resultado => 
        resultado.data && resultado.data.length > 0
      )

      if (!temDados) {
        setSemDados(true)
        setDashboardData(null)
        toast({
          title: "Período sem dados",
          description: "Período sem dados para ser processados",
          variant: "destructive"
        })
        return
      }
    } catch (verificacaoError) {
      console.error('Erro ao verificar balancetes:', verificacaoError)
      toast({
        title: "Erro",
        description: "Falha ao verificar dados disponíveis",
        variant: "destructive"
      })
      return
    }

    setSemDados(false)
    
    // Salvar filtros aplicados
    const currentFilters: SavedFilters = {
      empresaSelecionada,
      mesInicio,
      mesFim,
      timestamp: Date.now()
    }
    saveFiltersToStorage(currentFilters)
    
    // Verificar cache primeiro
    const cachedData = cache.get(cacheKey)
    const now = Date.now()
    const CACHE_DURATION = 15 * 60 * 1000 // 15 minutos
    
    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      setDashboardData(cachedData.data)
      toast({
        title: "Dados carregados do cache",
        description: "Os dados foram carregados rapidamente do cache local",
      })
      return
    }
    
    setLoading(true)
    
    try {
      const data = await carregarDadosDashboard()
      
      // Salvar no cache em memória e localStorage
      const cacheItem: CacheItem = {
        data,
        timestamp: now
      }
      
      const persistentCacheItem: PersistentCacheItem = {
        ...cacheItem,
        filters: currentFilters
      }
      
      setCache(prev => new Map(prev.set(cacheKey, cacheItem)))
      saveCacheToStorage(cacheKey, persistentCacheItem)
      
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

    // Buscar indicadores calculados do banco de dados
    const margemLiquidaMesFim = await buscarIndicadorCalculado(empresaSelecionada, 'Margem Líquida (%)', mesFimMes, anoFim)
    const margemLiquidaAcumulada = await buscarIndicadorCalculado(empresaSelecionada, 'Margem Líquida Acumulada (%)', mesFimMes, anoFim)

    // Processar dados dos indicadores para outros cálculos
    const indicadoresData = processarIndicadores(balancetes, parametrizacoes)
    
    // Calcular dados restantes do dashboard
    const fluxoResultados = await calcularFluxoResultados(empresaSelecionada, mesInicioMes, anoInicio, mesFimMes, anoFim)
    const dreResumo = await calcularDREResumo(empresaSelecionada, mesInicioMes, anoInicio, mesFimMes, anoFim)
    
    // Buscar dados dos novos gráficos
    const receitaOperacionalBruta = await buscarDadosIndicadorPorPeriodo(empresaSelecionada, 'Receitas Brutas', mesInicioMes, anoInicio, mesFimMes, anoFim)
    const liquidezCorrente = await buscarDadosIndicadorPorPeriodo(empresaSelecionada, 'Liquidez Corrente', mesInicioMes, anoInicio, mesFimMes, anoFim)
    const capitalCirculanteLiquido = await buscarDadosIndicadorPorPeriodo(empresaSelecionada, 'Capital Circulante Líquido (CCL)', mesInicioMes, anoInicio, mesFimMes, anoFim)
    
    // Buscar dados dos gráficos de peso
    console.log('🔄 Iniciando busca dos gráficos de peso...')
    const custosPesoReceita = await buscarDadosPesoIndicador(empresaSelecionada, 'Custos', 'Peso dos Custos sobre a Receita', mesInicioMes, anoInicio, mesFimMes, anoFim)
    const despesasPesoReceita = await buscarDadosPesoIndicador(empresaSelecionada, 'Despesas', 'Peso das Despesas sobre a Receita', mesInicioMes, anoInicio, mesFimMes, anoFim)
    const tributosPesoReceita = await buscarDadosPesoIndicador(empresaSelecionada, 'Tributos', 'Peso dos Tributos sobre a Receita', mesInicioMes, anoInicio, mesFimMes, anoFim)
    const folhaPesoReceita = await buscarDadosPesoIndicador(empresaSelecionada, 'Folha e Encargos', 'Peso da Folha sobre a Receita', mesInicioMes, anoInicio, mesFimMes, anoFim)
    
    console.log('✅ Dados de peso recuperados:', {
      custosPesoReceita: custosPesoReceita.meses.length,
      despesasPesoReceita: despesasPesoReceita.meses.length,
      tributosPesoReceita: tributosPesoReceita.meses.length,
      folhaPesoReceita: folhaPesoReceita.meses.length
    })
    
    return {
      empresa: empresaData,
      margemLiquidaMesFim,
      margemLiquidaAcumulada,
      fluxoResultados,
      dreResumo,
      receitaOperacionalBruta,
      liquidezCorrente,
      capitalCirculanteLiquido,
      custosPesoReceita,
      despesasPesoReceita,
      tributosPesoReceita,
      folhaPesoReceita
    }
  }

  const buscarIndicadorCalculado = async (empresaCnpj: string, nomeIndicador: string, mes: number, ano: number): Promise<number | null> => {
    try {
      const { data, error } = await supabase
        .from('indicadores_calculados')
        .select('valor')
        .eq('empresa_cnpj', empresaCnpj)
        .eq('nome_indicador', nomeIndicador)
        .eq('mes', mes)
        .eq('ano', ano)
        .maybeSingle()

      if (error) throw error
      return data?.valor || null
    } catch (error) {
      console.error(`Erro ao buscar indicador ${nomeIndicador}:`, error)
      return null
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
  
  const buscarIndicadoresPorPeriodo = async (empresaCnpj: string, indicadores: string[], mesInicio: number, anoInicio: number, mesFim: number, anoFim: number): Promise<{[mes: string]: {[indicador: string]: number | null}}> => {
    try {
      const dadosPorMes: {[mes: string]: {[indicador: string]: number | null}} = {}
      
      // Iterar pelos meses do período
      for (let ano = anoInicio; ano <= anoFim; ano++) {
        const mesInicioAtual = ano === anoInicio ? mesInicio : 1
        const mesFimAtual = ano === anoFim ? mesFim : 12
        
        for (let mes = mesInicioAtual; mes <= mesFimAtual; mes++) {
          const chaveMes = `${mes.toString().padStart(2, '0')}/${ano}`
          dadosPorMes[chaveMes] = {}
          
          // Buscar cada indicador para o mês
          for (const indicador of indicadores) {
            const { data, error } = await supabase
              .from('indicadores_calculados')
              .select('valor')
              .eq('empresa_cnpj', empresaCnpj)
              .eq('nome_indicador', indicador)
              .eq('mes', mes)
              .eq('ano', ano)
              .maybeSingle()
            
            if (error) {
              console.error(`Erro ao buscar indicador ${indicador}:`, error)
              dadosPorMes[chaveMes][indicador] = null
            } else {
              dadosPorMes[chaveMes][indicador] = data?.valor || null
            }
          }
        }
      }
      
      return dadosPorMes
    } catch (error) {
      console.error('Erro ao buscar indicadores por período:', error)
      return {}
    }
  }

  const buscarDadosIndicadorPorPeriodo = async (empresaCnpj: string, nomeIndicador: string, mesInicio: number, anoInicio: number, mesFim: number, anoFim: number): Promise<{meses: string[], valores: number[]}> => {
    try {
      const meses: string[] = []
      const valores: number[] = []
      
      // Iterar pelos meses do período
      for (let ano = anoInicio; ano <= anoFim; ano++) {
        const mesInicioAtual = ano === anoInicio ? mesInicio : 1
        const mesFimAtual = ano === anoFim ? mesFim : 12
        
        for (let mes = mesInicioAtual; mes <= mesFimAtual; mes++) {
          const chaveMes = `${mes.toString().padStart(2, '0')}/${ano}`
          meses.push(chaveMes)
          
          const { data, error } = await supabase
            .from('indicadores_calculados')
            .select('valor')
            .eq('empresa_cnpj', empresaCnpj)
            .eq('nome_indicador', nomeIndicador)
            .eq('mes', mes)
            .eq('ano', ano)
            .maybeSingle()
          
          if (error) {
            console.error(`Erro ao buscar indicador ${nomeIndicador}:`, error)
            valores.push(0)
          } else {
            valores.push(data?.valor || 0)
          }
        }
      }
      
      return { meses, valores }
    } catch (error) {
      console.error(`Erro ao buscar dados do indicador ${nomeIndicador}:`, error)
      return { meses: [], valores: [] }
    }
  }

  const buscarDadosPesoIndicador = async (empresaCnpj: string, nomeIndicadorAbsoluto: string, nomeIndicadorPercentual: string, mesInicio: number, anoInicio: number, mesFim: number, anoFim: number) => {
    try {
      console.log(`🔍 Buscando dados de peso para empresa: ${empresaCnpj}`)
      console.log(`📊 Indicador Absoluto: ${nomeIndicadorAbsoluto}`)
      console.log(`📈 Indicador Percentual: ${nomeIndicadorPercentual}`)
      console.log(`📅 Período: ${mesInicio}/${anoInicio} até ${mesFim}/${anoFim}`)
      
      const meses: string[] = []
      const valoresAbsolutos: number[] = []
      const valoresPercentuais: number[] = []
      
      // Primeiro, vamos verificar se os indicadores existem
      const { data: indicadoresExistentes, error: errorCheck } = await supabase
        .from('indicadores_calculados')
        .select('nome_indicador')
        .eq('empresa_cnpj', empresaCnpj)
        .in('nome_indicador', [nomeIndicadorAbsoluto, nomeIndicadorPercentual])
        .limit(10)
      
      console.log(`🔎 Indicadores encontrados para empresa ${empresaCnpj}:`, indicadoresExistentes?.map(i => i.nome_indicador) || [])
      
      // Iterar pelos meses do período
      for (let ano = anoInicio; ano <= anoFim; ano++) {
        const mesInicioAtual = ano === anoInicio ? mesInicio : 1
        const mesFimAtual = ano === anoFim ? mesFim : 12
        
        for (let mes = mesInicioAtual; mes <= mesFimAtual; mes++) {
          const chaveMes = `${mes.toString().padStart(2, '0')}/${ano}`
          meses.push(chaveMes)
          
          // Buscar valor absoluto
          const { data: dataAbsoluto, error: errorAbsoluto } = await supabase
            .from('indicadores_calculados')
            .select('valor')
            .eq('empresa_cnpj', empresaCnpj)
            .eq('nome_indicador', nomeIndicadorAbsoluto)
            .eq('mes', mes)
            .eq('ano', ano)
            .maybeSingle()
          
          // Buscar valor percentual
          const { data: dataPercentual, error: errorPercentual } = await supabase
            .from('indicadores_calculados')
            .select('valor')
            .eq('empresa_cnpj', empresaCnpj)
            .eq('nome_indicador', nomeIndicadorPercentual)
            .eq('mes', mes)
            .eq('ano', ano)
            .maybeSingle()
          
          console.log(`📊 ${chaveMes} - ${nomeIndicadorAbsoluto}: ${dataAbsoluto?.valor || 0}, ${nomeIndicadorPercentual}: ${dataPercentual?.valor || 0}`)
          
          if (errorAbsoluto || errorPercentual) {
            console.error(`❌ Erro ao buscar indicadores de peso para ${chaveMes}:`, errorAbsoluto || errorPercentual)
            valoresAbsolutos.push(0)
            valoresPercentuais.push(0)
          } else {
            const valorAbsoluto = dataAbsoluto?.valor || 0
            const valorPercentual = dataPercentual?.valor || 0
            
            // Para custos, despesas, etc., não precisa Math.abs() pois já vêm como valores positivos
            valoresAbsolutos.push(valorAbsoluto)
            valoresPercentuais.push(valorPercentual)
            
            console.log(`📊 ${chaveMes} - Absoluto: ${valorAbsoluto}, Percentual: ${valorPercentual}`)
          }
        }
      }
      
      const resultado = {
        meses,
        valoresAbsolutos,
        valoresPercentuais,
        labelAbsoluto: nomeIndicadorAbsoluto,
        labelPercentual: "Peso sobre a Receita"
      }
      
      console.log(`✅ Resultado final para ${nomeIndicadorAbsoluto}:`, resultado)
      
      return resultado
    } catch (error) {
      console.error(`💥 Erro ao buscar dados de peso:`, error)
      return {
        meses: [],
        valoresAbsolutos: [],
        valoresPercentuais: [],
        labelAbsoluto: nomeIndicadorAbsoluto,
        labelPercentual: "Peso sobre a Receita"
      }
    }
  }

  const calcularFluxoResultados = async (empresaCnpj: string, mesInicio: number, anoInicio: number, mesFim: number, anoFim: number) => {
    const meses: string[] = []
    const receitas: number[] = []
    const custosEDespesas: number[] = []
    const resultadoLiquido: number[] = []
    
    // Buscar dados dos indicadores do banco
    const indicadoresNecessarios = ['Receitas Líquidas', 'Custos e Despesas', 'Resultado Líquido']
    const dadosIndicadores = await buscarIndicadoresPorPeriodo(empresaCnpj, indicadoresNecessarios, mesInicio, anoInicio, mesFim, anoFim)
    
    // Iterar pelos meses do período
    for (let ano = anoInicio; ano <= anoFim; ano++) {
      const mesInicioAtual = ano === anoInicio ? mesInicio : 1
      const mesFimAtual = ano === anoFim ? mesFim : 12
      
      for (let mes = mesInicioAtual; mes <= mesFimAtual; mes++) {
        const chaveMes = `${mes.toString().padStart(2, '0')}/${ano}`
        meses.push(chaveMes)
        
        const dadosMes = dadosIndicadores[chaveMes]
        
        if (dadosMes) {
          const receitasMes = Math.abs(dadosMes['Receitas Líquidas'] || 0)
          const custosEDespesasMes = Math.abs(dadosMes['Custos e Despesas'] || 0)
          const resultadoMes = dadosMes['Resultado Líquido'] || 0
          
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
  
  const calcularDREResumo = async (empresaCnpj: string, mesInicio: number, anoInicio: number, mesFim: number, anoFim: number) => {
    const meses: string[] = []
    
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

    // Buscar indicadores necessários do banco de dados
    const indicadoresNecessarios = [
      'Receitas Brutas',
      'Deduções das Receitas',
      'Custos',
      'Despesas',
      'Outras Receitas Operacionais'
    ]
    const dadosIndicadores = await buscarIndicadoresPorPeriodo(empresaCnpj, indicadoresNecessarios, mesInicio, anoInicio, mesFim, anoFim)
    
    // Iterar pelos meses do período
    for (let ano = anoInicio; ano <= anoFim; ano++) {
      const mesInicioAtual = ano === anoInicio ? mesInicio : 1
      const mesFimAtual = ano === anoFim ? mesFim : 12
      
      for (let mes = mesInicioAtual; mes <= mesFimAtual; mes++) {
        const chaveMes = `${mes.toString().padStart(2, '0')}/${ano}`
        meses.push(chaveMes)
        
        const dadosMes = dadosIndicadores[chaveMes]
        
        if (dadosMes) {
          const receitaBruta = Math.abs(dadosMes['Receitas Brutas'] || 0)
          const deducoes = Math.abs(dadosMes['Deduções das Receitas'] || 0)
          const receitaLiquida = receitaBruta - deducoes
          const custos = Math.abs(dadosMes['Custos'] || 0)
          const lucroBruto = receitaLiquida - custos
          const despesas = Math.abs(dadosMes['Despesas'] || 0)
          const outrasReceitas = Math.abs(dadosMes['Outras Receitas Operacionais'] || 0)
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
              <Select value={empresaSelecionada} onValueChange={handleEmpresaChange}>
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
      {!dashboardData && !loading && !semDados && (
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

      {/* Aviso de período sem dados */}
      {semDados && !loading && (
        <Card className="py-12 border-destructive/50">
          <CardContent className="text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-destructive">Período sem dados para ser processados</h3>
            <p className="text-muted-foreground">
              Não foram encontrados balancetes parametrizados para o período selecionado
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
            <TabsTrigger value="pesos">Pesos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="resumo" className="space-y-6">
            {/* Gráficos de Lucratividade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Lucratividade do mês
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenChart({
                        type: 'doughnut',
                        data: { data: dashboardData.margemLiquidaMesFim, label: "Margem Líquida (%)" },
                        title: 'Lucratividade do mês'
                      })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
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
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Lucratividade Acumulada no Período
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenChart({
                        type: 'doughnut',
                        data: { data: dashboardData.margemLiquidaAcumulada, label: "Margem Líquida Acumulada (%)" },
                        title: 'Lucratividade Acumulada no Período'
                      })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
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
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Fluxo de Resultados
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFullscreenChart({
                      type: 'mixed',
                      data: dashboardData.fluxoResultados,
                      title: 'Fluxo de Resultados'
                    })}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MixedChart data={dashboardData.fluxoResultados} />
              </CardContent>
            </Card>
            
            {/* Novos Gráficos dos Indicadores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Receita Operacional Bruta
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenChart({
                        type: 'bar',
                        data: dashboardData.receitaOperacionalBruta,
                        title: 'Receita Operacional Bruta'
                      })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChart
                    data={dashboardData.receitaOperacionalBruta}
                    title="Receita Operacional Bruta"
                    label="Receitas Brutas"
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Liquidez Corrente
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenChart({
                        type: 'line',
                        data: dashboardData.liquidezCorrente,
                        title: 'Liquidez Corrente'
                      })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LineChart
                    data={dashboardData.liquidezCorrente}
                    title="Liquidez Corrente"
                    label="Liquidez Corrente"
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Capital Circulante Líquido
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenChart({
                        type: 'area',
                        data: dashboardData.capitalCirculanteLiquido,
                        title: 'Capital Circulante Líquido'
                      })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AreaChart
                    data={dashboardData.capitalCirculanteLiquido}
                    title="Capital Circulante Líquido"
                    label="Capital Circulante Líquido (CCL)"
                  />
                </CardContent>
              </Card>
            </div>
            
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
          
          <TabsContent value="pesos" className="space-y-6">
            {/* Gráficos de Peso sobre a Receita */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Custos x Peso sobre a Receita
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenChart({
                        type: 'peso',
                        data: dashboardData.custosPesoReceita,
                        title: 'Custos x Peso sobre a Receita'
                      })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PesoChart data={dashboardData.custosPesoReceita} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Despesas x Peso sobre a Receita
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenChart({
                        type: 'peso',
                        data: dashboardData.despesasPesoReceita,
                        title: 'Despesas x Peso sobre a Receita'
                      })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PesoChart data={dashboardData.despesasPesoReceita} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Tributos x Peso sobre a Receita
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenChart({
                        type: 'peso',
                        data: dashboardData.tributosPesoReceita,
                        title: 'Tributos x Peso sobre a Receita'
                      })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PesoChart data={dashboardData.tributosPesoReceita} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Folha x Peso sobre a Receita
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenChart({
                        type: 'peso',
                        data: dashboardData.folhaPesoReceita,
                        title: 'Folha x Peso sobre a Receita'
                      })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PesoChart data={dashboardData.folhaPesoReceita} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Modal de tela cheia */}
      <Dialog open={!!fullscreenChart} onOpenChange={() => setFullscreenChart(null)}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>{fullscreenChart?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center p-4">
            {fullscreenChart?.type === 'doughnut' && (
              <div className="w-full max-w-2xl">
                <DoughnutChart
                  data={fullscreenChart.data.data}
                  label={fullscreenChart.data.label}
                />
              </div>
            )}
            {fullscreenChart?.type === 'mixed' && (
              <div className="w-full h-full">
                <MixedChart data={fullscreenChart.data} />
              </div>
            )}
            {fullscreenChart?.type === 'bar' && (
              <div className="w-full h-full">
                <BarChart
                  data={fullscreenChart.data}
                  title={fullscreenChart.title}
                  label="Receitas Brutas"
                />
              </div>
            )}
            {fullscreenChart?.type === 'line' && (
              <div className="w-full h-full">
                <LineChart
                  data={fullscreenChart.data}
                  title={fullscreenChart.title}
                  label="Liquidez Corrente"
                />
              </div>
            )}
            {fullscreenChart?.type === 'area' && (
              <div className="w-full h-full">
                <AreaChart
                  data={fullscreenChart.data}
                  title={fullscreenChart.title}
                  label="Capital Circulante Líquido (CCL)"
                />
              </div>
            )}
            {fullscreenChart?.type === 'peso' && (
              <div className="w-full h-full">
                <PesoChart data={fullscreenChart.data} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}