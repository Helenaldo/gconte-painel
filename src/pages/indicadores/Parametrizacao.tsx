import { useState, useMemo } from "react"
import { Search, ChevronRight, ChevronDown, Save, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"

// Plano de Contas Padrão
const planoContasPadrao = [
  {
    codigo: "1",
    nome: "ATIVO",
    filhas: [
      {
        codigo: "1.1",
        nome: "ATIVO CIRCULANTE",
        filhas: [
          {
            codigo: "1.1.1",
            nome: "DISPONÍVEL",
            filhas: [
              { codigo: "1.1.1.01", nome: "Caixa e equivalente de caixa" },
              { codigo: "1.1.1.02", nome: "Bancos" },
              { codigo: "1.1.1.03", nome: "Investimentos de liquidez imediata" }
            ]
          },
          {
            codigo: "1.1.2",
            nome: "CONTAS A RECEBER",
            filhas: [
              { codigo: "1.1.2.01", nome: "Clientes" },
              { codigo: "1.1.2.02", nome: "Outros valores a receber a curto prazo" }
            ]
          },
          { codigo: "1.1.3", nome: "ESTOQUES" }
        ]
      },
      {
        codigo: "1.2",
        nome: "ATIVO NÃO CIRCULANTE",
        filhas: [
          { codigo: "1.2.1", nome: "Realizável a longo prazo" },
          { codigo: "1.2.2", nome: "Investimentos" },
          { codigo: "1.2.3", nome: "Imobilizado" },
          { codigo: "1.2.4", nome: "Intangível" }
        ]
      }
    ]
  },
  {
    codigo: "2",
    nome: "PASSIVO",
    filhas: [
      {
        codigo: "2.1",
        nome: "PASSIVO CIRCULANTE",
        filhas: [
          { codigo: "2.1.1", nome: "Fornecedores" },
          { codigo: "2.1.2", nome: "Obrigações sociais" },
          { codigo: "2.1.3", nome: "Obrigações trabalhistas" },
          { codigo: "2.1.4", nome: "Obrigações fiscais" },
          { codigo: "2.1.5", nome: "Provisões a pagar" },
          { codigo: "2.1.6", nome: "Tributos parcelados" },
          { codigo: "2.1.7", nome: "Empréstimos e financiamentos" },
          { codigo: "2.1.8", nome: "Outras contas a pagar de curto prazo" }
        ]
      },
      {
        codigo: "2.2",
        nome: "PASSIVO NÃO CIRCULANTE",
        filhas: [
          { codigo: "2.2.1", nome: "Exigível a longo prazo" },
          { codigo: "2.2.2", nome: "Empréstimos e financiamentos" },
          { codigo: "2.2.3", nome: "Tributos parcelados" }
        ]
      }
    ]
  },
  {
    codigo: "3",
    nome: "PATRIMÔNIO LÍQUIDO",
    filhas: [
      { codigo: "3.1", nome: "Capital social" },
      { codigo: "3.2", nome: "Reservas" },
      { codigo: "3.3", nome: "Lucro ou prejuízos acumulados" }
    ]
  },
  {
    codigo: "4",
    nome: "RECEITAS",
    filhas: [
      { codigo: "4.1", nome: "Receita operacional" },
      { codigo: "4.2", nome: "Receita bruta" },
      { codigo: "4.3", nome: "Deduções da receita" },
      { codigo: "4.4", nome: "Receita financeira" },
      { codigo: "4.5", nome: "Receita não operacional" }
    ]
  },
  {
    codigo: "5",
    nome: "CUSTOS E DESPESAS",
    filhas: [
      {
        codigo: "5.1",
        nome: "CUSTOS",
        filhas: [
          { codigo: "5.1.1", nome: "Custos dos serviços/produtos/mercadorias vendidas" },
          { codigo: "5.1.2", nome: "Custos com pessoal" },
          { codigo: "5.1.3", nome: "Custos com encargos sociais" }
        ]
      },
      {
        codigo: "5.2",
        nome: "DESPESAS OPERACIONAIS",
        filhas: [
          { codigo: "5.2.1", nome: "Despesas administrativas" },
          { codigo: "5.2.2", nome: "Despesas financeiras" },
          { codigo: "5.2.3", nome: "Despesas tributárias (IRPJ e CSLL)" },
          { codigo: "5.2.4", nome: "Despesas não operacionais" }
        ]
      }
    ]
  }
]

// Contas do Balancete (simuladas)
const contasBalancete = [
  { codigo: "1.01.01", nome: "CAIXA", saldoAtual: 5000.00, natureza: "devedora" },
  { codigo: "1.01.02", nome: "BANCO CONTA MOVIMENTO", saldoAtual: 25000.00, natureza: "devedora" },
  { codigo: "1.01.03", nome: "APLICAÇÕES FINANCEIRAS", saldoAtual: 15000.00, natureza: "devedora" },
  { codigo: "1.02.01", nome: "DUPLICATAS A RECEBER", saldoAtual: 45000.00, natureza: "devedora" },
  { codigo: "1.02.02", nome: "OUTROS CRÉDITOS", saldoAtual: 8000.00, natureza: "devedora" },
  { codigo: "1.03.01", nome: "ESTOQUE DE MERCADORIAS", saldoAtual: 35000.00, natureza: "devedora" },
  { codigo: "1.04.01", nome: "IMÓVEIS", saldoAtual: 200000.00, natureza: "devedora" },
  { codigo: "2.01.01", nome: "FORNECEDORES", saldoAtual: -28000.00, natureza: "credora" },
  { codigo: "2.01.02", nome: "SALÁRIOS A PAGAR", saldoAtual: -12000.00, natureza: "credora" },
  { codigo: "2.01.03", nome: "IMPOSTOS A RECOLHER", saldoAtual: -8500.00, natureza: "credora" },
  { codigo: "3.01.01", nome: "CAPITAL SOCIAL", saldoAtual: -100000.00, natureza: "credora" },
  { codigo: "3.03.01", nome: "LUCROS ACUMULADOS", saldoAtual: -50000.00, natureza: "credora" },
  { codigo: "4.01.01", nome: "RECEITA DE VENDAS", saldoAtual: -120000.00, natureza: "credora" },
  { codigo: "5.01.01", nome: "CUSTO DAS MERCADORIAS VENDIDAS", saldoAtual: 75000.00, natureza: "devedora" },
  { codigo: "5.02.01", nome: "DESPESAS ADMINISTRATIVAS", saldoAtual: 18000.00, natureza: "devedora" }
]

interface ContaPadrao {
  codigo: string
  nome: string
  filhas?: ContaPadrao[]
}

interface Parametrizacao {
  contaPadraoId: string
  contasBalancete: string[]
  valorTotal: number
}

export function Parametrizacao() {
  const [empresaSelecionada, setEmpresaSelecionada] = useState("")
  const [periodoSelecionado, setPeriodoSelecionado] = useState("")
  const [filtroBalancete, setFiltroBalancete] = useState("")
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [contaPadraoSelecionada, setContaPadraoSelecionada] = useState<string | null>(null)
  const [parametrizacoes, setParametrizacoes] = useState<Record<string, Parametrizacao>>({})
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const contasFiltradasBalancete = useMemo(() => {
    return contasBalancete.filter(conta => 
      conta.codigo.toLowerCase().includes(filtroBalancete.toLowerCase()) ||
      conta.nome.toLowerCase().includes(filtroBalancete.toLowerCase())
    )
  }, [filtroBalancete])

  const toggleNode = (codigo: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(codigo)) {
      newExpanded.delete(codigo)
    } else {
      newExpanded.add(codigo)
    }
    setExpandedNodes(newExpanded)
  }

  const handleContaBalanceteToggle = (codigoConta: string, checked: boolean) => {
    if (!contaPadraoSelecionada) return

    const parametrizacao = parametrizacoes[contaPadraoSelecionada] || {
      contaPadraoId: contaPadraoSelecionada,
      contasBalancete: [],
      valorTotal: 0
    }

    let novasContas
    if (checked) {
      novasContas = [...parametrizacao.contasBalancete, codigoConta]
    } else {
      novasContas = parametrizacao.contasBalancete.filter(c => c !== codigoConta)
    }

    const valorTotal = novasContas.reduce((total, codigo) => {
      const conta = contasBalancete.find(c => c.codigo === codigo)
      return total + Math.abs(conta?.saldoAtual || 0)
    }, 0)

    setParametrizacoes({
      ...parametrizacoes,
      [contaPadraoSelecionada]: {
        ...parametrizacao,
        contasBalancete: novasContas,
        valorTotal
      }
    })
  }

  const isContaParametrizada = (codigoConta: string) => {
    return Object.values(parametrizacoes).some(p => 
      p.contasBalancete.includes(codigoConta)
    )
  }

  const renderContaPadrao = (conta: ContaPadrao, level: number = 0) => {
    const isExpanded = expandedNodes.has(conta.codigo)
    const hasFilhas = conta.filhas && conta.filhas.length > 0
    const isSelected = contaPadraoSelecionada === conta.codigo
    const isParametrizada = parametrizacoes[conta.codigo]

    return (
      <div key={conta.codigo}>
        <div 
          className={`flex items-center gap-2 p-2 hover:bg-muted/50 cursor-pointer rounded-md ${
            isSelected ? 'bg-primary/10 border border-primary/20' : ''
          } ${isParametrizada ? 'bg-green-50 border-green-200' : ''}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => setContaPadraoSelecionada(conta.codigo)}
        >
          {hasFilhas && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNode(conta.codigo)
              }}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          {!hasFilhas && <div className="w-6" />}
          
          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm font-mono text-muted-foreground">
              {conta.codigo}
            </span>
            <span className="text-sm">{conta.nome}</span>
            {isParametrizada && (
              <Check className="h-4 w-4 text-green-600" />
            )}
          </div>
          
          {isParametrizada && (
            <Badge variant="outline" className="text-xs">
              R$ {parametrizacoes[conta.codigo].valorTotal.toLocaleString('pt-BR', {
                minimumFractionDigits: 2
              })}
            </Badge>
          )}
        </div>
        
        {hasFilhas && isExpanded && (
          <div>
            {conta.filhas!.map(filha => renderContaPadrao(filha, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const totalContasParametrizadas = Object.keys(parametrizacoes).length
  const totalContasPadrao = 50 // Valor estimado das contas do plano padrão
  const progressoParametrizacao = (totalContasParametrizadas / totalContasPadrao) * 100

  const handleSalvarParametrizacao = async () => {
    setIsSaving(true)
    try {
      // Simular salvamento
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast({
        title: "Parametrização salva",
        description: "As parametrizações foram salvas com sucesso"
      })
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar as parametrizações",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleLimparParametrizacao = () => {
    setParametrizacoes({})
    setContaPadraoSelecionada(null)
    toast({
      title: "Parametrização limpa",
      description: "Todas as parametrizações foram removidas"
    })
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parametrização</h1>
          <p className="text-muted-foreground">
            Configure o mapeamento entre as contas do balancete e o plano de contas padrão
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecionar empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empresa1">EMPRESA EXEMPLO LTDA</SelectItem>
                <SelectItem value="empresa2">COMÉRCIO ABC LTDA</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12/2023">12/2023</SelectItem>
                <SelectItem value="11/2023">11/2023</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />
            
            <Badge variant="outline" className="text-sm">
              {totalContasParametrizadas}/{totalContasPadrao} contas parametrizadas
            </Badge>
          </div>
          
          <div className="mt-4">
            <Progress value={progressoParametrizacao} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {progressoParametrizacao.toFixed(1)}% completo
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Layout Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-400px)]">
        {/* Coluna Esquerda - Plano de Contas Padrão */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Plano de Contas Padrão</CardTitle>
            <p className="text-sm text-muted-foreground">
              Clique em uma conta para parametrizar
            </p>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <div className="space-y-1">
              {planoContasPadrao.map(conta => renderContaPadrao(conta))}
            </div>
          </CardContent>
        </Card>

        {/* Coluna Direita - Contas do Balancete */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Contas do Balancete</CardTitle>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conta por código ou nome..."
                value={filtroBalancete}
                onChange={(e) => setFiltroBalancete(e.target.value)}
                className="flex-1"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {contaPadraoSelecionada && (
              <div className="mb-4 p-3 bg-primary/5 rounded-lg border">
                <p className="text-sm font-medium">Parametrizando conta:</p>
                <p className="text-sm text-muted-foreground">{contaPadraoSelecionada}</p>
              </div>
            )}
            
            <div className="space-y-2">
              {contasFiltradasBalancete.map((conta) => {
                const isChecked = parametrizacoes[contaPadraoSelecionada || '']?.contasBalancete.includes(conta.codigo) || false
                const isParametrizadaEmOutraConta = !isChecked && isContaParametrizada(conta.codigo)
                
                return (
                  <div 
                    key={conta.codigo}
                    className={`flex items-center gap-3 p-3 border rounded-lg ${
                      isParametrizadaEmOutraConta ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      disabled={!contaPadraoSelecionada || isParametrizadaEmOutraConta}
                      onCheckedChange={(checked) => 
                        handleContaBalanceteToggle(conta.codigo, checked as boolean)
                      }
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-mono text-muted-foreground">
                            {conta.codigo}
                          </p>
                          <p className="text-sm font-medium">{conta.nome}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            R$ {Math.abs(conta.saldoAtual).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {conta.natureza}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {isParametrizadaEmOutraConta && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Ações Fixa */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="container mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSalvarParametrizacao}
              disabled={isSaving || Object.keys(parametrizacoes).length === 0}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar Parametrização
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleLimparParametrizacao}
              disabled={Object.keys(parametrizacoes).length === 0}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Limpar Parametrização
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {totalContasParametrizadas} de {totalContasPadrao} contas parametrizadas
          </div>
        </div>
      </div>
    </div>
  )
}