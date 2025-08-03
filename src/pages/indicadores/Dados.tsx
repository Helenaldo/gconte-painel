import { useState, useEffect } from "react"
import { CalendarIcon, Filter, RotateCcw, FileText, AlertTriangle, CheckCircle } from "lucide-react"
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

      // Para cada mês do ano
      for (const balancete of balancetes) {
        // Buscar contas do balancete
        const { data: contasBalancete, error: contasError } = await supabase
          .from('contas_balancete')
          .select('*')
          .eq('balancete_id', balancete.id)

        if (contasError) throw contasError

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

      setContasValidacao(validacoesContas)
      setBalancoValidacao(validacoesBalanco)

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
        const valorParametrizado = calcularValorParametrizado(conta, parametrizacoes, contasBalancete)
        const valorCalculado = nivel === 4 ? valorParametrizado : calcularSomaFilhas(conta, planoContas, parametrizacoes, contasBalancete)
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

    return validacoes
  }

  const calcularValorParametrizado = (conta: any, parametrizacoes: any[], contasBalancete: any[]) => {
    const contasParam = parametrizacoes.filter(p => p.plano_conta_id === conta.id)
    return contasParam.reduce((total, param) => {
      const contaBalancete = contasBalancete.find(cb => cb.codigo === param.conta_balancete_codigo)
      return total + (contaBalancete?.saldo_atual || 0)
    }, 0)
  }

  const calcularSomaFilhas = (contaMae: any, planoContas: any[], parametrizacoes: any[], contasBalancete: any[]) => {
    const contasFilhas = planoContas.filter(c => 
      c.codigo.startsWith(contaMae.codigo + '.') && 
      c.codigo.split('.').length === contaMae.codigo.split('.').length + 1
    )
    
    return contasFilhas.reduce((total, filha) => {
      return total + calcularValorParametrizado(filha, parametrizacoes, contasBalancete)
    }, 0)
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

    const ativo = contaAtivo ? calcularValorParametrizado(contaAtivo, parametrizacoes, contasBalancete) : 0
    const passivo = contaPassivo ? calcularValorParametrizado(contaPassivo, parametrizacoes, contasBalancete) : 0
    const receitas = contaReceitas ? calcularValorParametrizado(contaReceitas, parametrizacoes, contasBalancete) : 0
    const custoseDespesas = contaCustos ? calcularValorParametrizado(contaCustos, parametrizacoes, contasBalancete) : 0

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
                    <TableHead>Mês</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Passivo</TableHead>
                    <TableHead>Receitas</TableHead>
                    <TableHead>Custos e Despesas</TableHead>
                    <TableHead>Diferença Patrimonial</TableHead>
                    <TableHead>Diferença Resultado</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balancoValidacao.map((validacao, index) => (
                    <TableRow key={index} className={!validacao.isConsistente ? 'bg-destructive/10' : ''}>
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
                    </TableRow>
                  ))}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                    .map((conta, index) => (
                      <TableRow key={index} className="bg-destructive/10">
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
                    ))}
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