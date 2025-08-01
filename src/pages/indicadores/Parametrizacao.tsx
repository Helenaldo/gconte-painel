import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Save, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface PlanoContaItem {
  id: string
  codigo: string
  nome: string
  tipo: string
  grupo: string
}

interface ContaBalancete {
  id: string
  codigo: string
  nome: string
  saldo_atual: number
  natureza: string
  parametrizada: boolean
}

interface Parametrizacao {
  plano_conta_id: string
  conta_balancete_codigo: string
  conta_balancete_nome: string
}

export function Parametrizacao() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const balanceteId = searchParams.get('balancete_id')
  const [balancete, setBalancete] = useState<any>(null)
  const [planoContas, setPlanoContas] = useState<PlanoContaItem[]>([])
  const [contasBalancete, setContasBalancete] = useState<ContaBalancete[]>([])
  const [parametrizacoes, setParametrizacoes] = useState<Parametrizacao[]>([])
  
  const [contaSelecionada, setContaSelecionada] = useState<string>("")
  const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([])
  const [parametrizacoesPendentes, setParametrizacoesPendentes] = useState<{[key: string]: string[]}>({})
  const [filtroPlano, setFiltroPlano] = useState("")
  const [filtroBalancete, setFiltroBalancete] = useState("")

  useEffect(() => {
    if (balanceteId) {
      loadData()
    }
  }, [balanceteId])

  const loadData = async () => {
    try {
      console.log('🔍 Carregando dados para balancete ID:', balanceteId)
      
      // Carregar dados do balancete
      const { data: balanceteData, error: balanceteError } = await supabase
        .from('balancetes')
        .select('*')
        .eq('id', balanceteId)
        .single()

      if (balanceteError) throw balanceteError
      console.log('📋 Dados do balancete carregados:', balanceteData)
      setBalancete(balanceteData)

      // Carregar plano de contas
      const { data: planoData, error: planoError } = await supabase
        .from('plano_contas')
        .select('*')
        .order('codigo')

      if (planoError) throw planoError
      console.log('📊 Plano de contas carregado:', planoData?.length, 'contas')
      setPlanoContas(planoData)

      // Carregar contas do balancete
      const { data: contasData, error: contasError } = await supabase
        .from('contas_balancete')
        .select('*')
        .eq('balancete_id', balanceteId)
        .order('codigo')

      if (contasError) throw contasError
      console.log('💰 Contas do balancete carregadas:', contasData?.length, 'contas')

      // Carregar parametrizações existentes
      const { data: paramData, error: paramError } = await supabase
        .from('parametrizacoes')
        .select('*')
        .eq('empresa_cnpj', balanceteData.cnpj)

      if (paramError) throw paramError
      console.log('⚙️ Parametrizações existentes:', paramData?.length, 'parametrizações')
      setParametrizacoes(paramData)

      // Marcar contas já parametrizadas
      const contasComStatus = contasData.map(conta => ({
        ...conta,
        parametrizada: paramData.some(p => p.conta_balancete_codigo === conta.codigo)
      }))

      console.log('✅ Contas com status de parametrização:', contasComStatus.length)
      setContasBalancete(contasComStatus)
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error)
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as informações do balancete",
        variant: "destructive"
      })
    }
  }

  const handlePlanoContaClick = (planoContaId: string) => {
    console.log('🖱️ Clique na conta do plano:', planoContaId)
    setContaSelecionada(planoContaId)
    
    // Carregar contas já parametrizadas + pendentes para esta conta do plano
    const contasParam = parametrizacoes
      .filter(p => p.plano_conta_id === planoContaId)
      .map(p => p.conta_balancete_codigo)
    
    const contasPendentes = parametrizacoesPendentes[planoContaId] || []
    const todasContas = [...new Set([...contasParam, ...contasPendentes])]
    
    setContasSelecionadas(todasContas)
  }

  const handleContaBalanceteToggle = (codigoConta: string, checked: boolean) => {
    if (!contaSelecionada) return
    
    console.log('🔄 Toggle conta balancete:', { codigoConta, checked, contaSelecionada })
    
    if (checked) {
      setContasSelecionadas(prev => {
        const novasContas = [...new Set([...prev, codigoConta])]
        console.log('✅ Contas selecionadas após adicionar:', novasContas)
        return novasContas
      })
      // Adicionar nas parametrizações pendentes (evitar duplicatas)
      setParametrizacoesPendentes(prev => {
        const contasExistentes = prev[contaSelecionada] || []
        const novasContas = [...new Set([...contasExistentes, codigoConta])]
        const novoState = {
          ...prev,
          [contaSelecionada]: novasContas
        }
        console.log('📝 Parametrizações pendentes após adicionar:', novoState)
        return novoState
      })
    } else {
      setContasSelecionadas(prev => {
        const novasContas = prev.filter(c => c !== codigoConta)
        console.log('❌ Contas selecionadas após remover:', novasContas)
        return novasContas
      })
      // Remover das parametrizações pendentes
      setParametrizacoesPendentes(prev => {
        const novoState = {
          ...prev,
          [contaSelecionada]: (prev[contaSelecionada] || []).filter(c => c !== codigoConta)
        }
        console.log('🗑️ Parametrizações pendentes após remover:', novoState)
        return novoState
      })
    }
  }

  const handleSalvarTodasParametrizacoes = async () => {
    if (!balancete || Object.keys(parametrizacoesPendentes).length === 0) {
      toast({
        title: "Nenhuma parametrização pendente",
        description: "Faça pelo menos uma parametrização antes de salvar",
        variant: "destructive"
      })
      return
    }

    try {
      // Processar todas as parametrizações pendentes
      for (const [planoContaId, contasCodigos] of Object.entries(parametrizacoesPendentes)) {
        // Sempre remover parametrizações existentes para esta conta do plano
        await supabase
          .from('parametrizacoes')
          .delete()
          .eq('empresa_cnpj', balancete.cnpj)
          .eq('plano_conta_id', planoContaId)

        // Inserir novas parametrizações apenas se houver contas selecionadas
        if (contasCodigos.length > 0) {
          const novasParametrizacoes = contasCodigos.map(codigoConta => {
            const conta = contasBalancete.find(c => c.codigo === codigoConta)
            return {
              empresa_cnpj: balancete.cnpj,
              plano_conta_id: planoContaId,
              conta_balancete_codigo: codigoConta,
              conta_balancete_nome: conta?.nome || ""
            }
          })

          const { error } = await supabase
            .from('parametrizacoes')
            .insert(novasParametrizacoes)

          if (error) throw error
        }
      }

      // Limpar parametrizações pendentes e recarregar dados
      setParametrizacoesPendentes({})
      setContaSelecionada("")
      setContasSelecionadas([])
      await loadData()
      
      toast({
        title: "Parametrizações salvas",
        description: "Todas as configurações foram salvas com sucesso"
      })
    } catch (error) {
      console.error('Erro ao salvar:', error)
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as parametrizações",
        variant: "destructive"
      })
    }
  }

  const getParametrizacaoInfo = (planoContaId: string) => {
    const contasParam = parametrizacoes
      .filter(p => p.plano_conta_id === planoContaId)
      .map(p => p.conta_balancete_codigo)
    
    const contasPendentes = parametrizacoesPendentes[planoContaId] || []
    const todasContas = [...new Set([...contasParam, ...contasPendentes])]
    
    if (todasContas.length === 0) return null
    
    const contasComSaldo = todasContas
      .map(codigo => contasBalancete.find(c => c.codigo === codigo))
      .filter(Boolean)
    
    const saldoTotal = contasComSaldo.reduce((sum, conta) => sum + (conta?.saldo_atual || 0), 0)
    const naturezaDominante = contasComSaldo.length > 0 ? contasComSaldo[0]?.natureza : 'devedora'
    
    return {
      saldo: saldoTotal,
      natureza: naturezaDominante,
      quantidadeContas: todasContas.length,
      isPendente: contasPendentes.length > 0
    }
  }

  const calcularSaldoTotal = () => {
    return contasSelecionadas.reduce((total, codigo) => {
      const conta = contasBalancete.find(c => c.codigo === codigo)
      return total + (conta?.saldo_atual || 0)
    }, 0)
  }

  const contasParametrizadas = contasBalancete.filter(c => c.parametrizada).length
  const totalContas = contasBalancete.length
  const progressoParametrizacao = totalContas > 0 ? (contasParametrizadas / totalContas) * 100 : 0

  const planoContasFiltradas = planoContas.filter(conta =>
    conta.nome.toLowerCase().includes(filtroPlano.toLowerCase()) ||
    conta.codigo.toLowerCase().includes(filtroPlano.toLowerCase())
  )

  const contasBalanceteFiltradas = contasBalancete.filter(conta =>
    conta.nome.toLowerCase().includes(filtroBalancete.toLowerCase()) ||
    conta.codigo.toLowerCase().includes(filtroBalancete.toLowerCase())
  )

  if (!balancete) {
    return <div>Carregando...</div>
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/indicadores/importar')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Parametrização do Balancete</h1>
          <p className="text-muted-foreground">
            {balancete.empresa} - {balancete.periodo}
          </p>
        </div>
        <Button 
          onClick={handleSalvarTodasParametrizacoes} 
          disabled={Object.keys(parametrizacoesPendentes).length === 0}
          className="bg-primary hover:bg-primary/90"
        >
          <Save className="h-4 w-4 mr-2" />
          Salvar Todas as Parametrizações
          {Object.keys(parametrizacoesPendentes).length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {Object.keys(parametrizacoesPendentes).length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso da Parametrização</span>
              <span>{contasParametrizadas}/{totalContas} contas</span>
            </div>
            <Progress value={progressoParametrizacao} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plano Padrão */}
        <Card>
          <CardHeader>
            <CardTitle>Plano Padrão</CardTitle>
            <CardDescription>Selecione uma conta para parametrizar</CardDescription>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Filtrar contas..."
                value={filtroPlano}
                onChange={(e) => setFiltroPlano(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            <div className="space-y-2">
              {planoContasFiltradas.map((conta) => (
                <div
                  key={conta.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    contaSelecionada === conta.id 
                      ? 'bg-primary/10 border-primary' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handlePlanoContaClick(conta.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{conta.codigo} - {conta.nome}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {conta.tipo.charAt(0).toUpperCase() + conta.tipo.slice(1)}
                        </Badge>
                        {(() => {
                          const info = getParametrizacaoInfo(conta.id)
                          if (info) {
                            return (
                              <>
                                <Badge 
                                  variant={info.isPendente ? "outline" : "default"}
                                  className={`text-xs ${info.isPendente ? 'border-orange-500 text-orange-700' : 'bg-green-600'}`}
                                >
                                  {info.isPendente ? 'Pendente' : 'Parametrizada'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  R$ {info.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {info.natureza}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  ({info.quantidadeContas} conta{info.quantidadeContas !== 1 ? 's' : ''})
                                </span>
                              </>
                            )
                          }
                          return null
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contas do Balancete */}
        <Card>
          <CardHeader>
            <CardTitle>Contas do Balancete</CardTitle>
            <CardDescription>
              {contaSelecionada ? 
                `Selecione as contas que correspondem à conta escolhida` :
                'Selecione uma conta do plano padrão primeiro'
              }
            </CardDescription>
            {contaSelecionada && (
              <>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <Input
                    placeholder="Filtrar contas..."
                    value={filtroBalancete}
                    onChange={(e) => setFiltroBalancete(e.target.value)}
                  />
                </div>
                {contasSelecionadas.length > 0 && (
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="text-sm font-medium">
                      Saldo Total Selecionado: R$ {calcularSaldoTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            {!contaSelecionada ? (
              <div className="text-center text-muted-foreground py-8">
                Selecione uma conta do plano padrão para começar
              </div>
            ) : (
              <div className="space-y-2">
                {contasBalanceteFiltradas.map((conta) => (
                  <div
                    key={conta.id}
                    className={`p-3 rounded-lg border ${
                      conta.parametrizada ? 'bg-green-50 border-green-200' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={contasSelecionadas.includes(conta.codigo)}
                        onCheckedChange={(checked) => 
                          handleContaBalanceteToggle(conta.codigo, checked as boolean)
                        }
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {conta.codigo} - {conta.nome}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Saldo: R$ {conta.saldo_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          <Badge variant="outline" className="ml-2">
                            {conta.natureza}
                          </Badge>
                          {conta.parametrizada && (
                            <Badge variant="default" className="ml-2 bg-green-600">
                              Parametrizada
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}