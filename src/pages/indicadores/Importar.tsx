import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Upload, FileSpreadsheet, Eye, Trash2, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import * as XLSX from 'xlsx'

interface BalanceteImportado {
  id: string
  empresa: string
  cnpj: string
  periodo: string
  ano: number
  status: 'pendente' | 'parametrizando' | 'parametrizado'
  totalContas: number
  contasParametrizadas: number
  dataImportacao: Date
}

export function Importar() {
  const navigate = useNavigate()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [balancetes, setBalancetes] = useState<BalanceteImportado[]>([])
  const [filtroEmpresa, setFiltroEmpresa] = useState("")
  const [filtroAno, setFiltroAno] = useState("todos")
  const { toast } = useToast()

  // Carregar balancetes do banco
  useEffect(() => {
    loadBalancetes()
  }, [])

  const loadBalancetes = async () => {
    try {
      const { data, error } = await supabase
        .from('balancetes')
        .select('*')
        .order('empresa', { ascending: true })
        .order('periodo', { ascending: false })

      if (error) throw error

      const balancetesFormatados = data.map(b => ({
        id: b.id,
        empresa: b.empresa,
        cnpj: b.cnpj,
        periodo: b.periodo,
        ano: b.ano,
        status: b.status as 'pendente' | 'parametrizando' | 'parametrizado',
        totalContas: b.total_contas,
        contasParametrizadas: b.contas_parametrizadas,
        dataImportacao: new Date(b.created_at)
      }))

      setBalancetes(balancetesFormatados)
    } catch (error) {
      console.error('Erro ao carregar balancetes:', error)
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os balancetes",
        variant: "destructive"
      })
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.name.endsWith('.xlsx')) {
      setArquivo(file)
    } else {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo .xlsx válido",
        variant: "destructive"
      })
    }
  }

  const handleImportarBalancete = async () => {
    if (!arquivo) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo para importar",
        variant: "destructive"
      })
      return
    }

    setIsUploading(true)
    
    try {
      // Ler o arquivo Excel
      const data = await arquivo.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      // Buscar informações da empresa (primeiras linhas do arquivo)
      let empresa = ""
      let cnpj = ""
      
      // Procurar empresa e CNPJ nas primeiras linhas
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i] as any[]
        if (row && row.length > 0) {
          const cellValue = String(row[0] || "")
          
          // Procurar padrão "Empresa: NOME - CNPJ: XX.XXX.XXX/XXXX-XX"
          const empresaCnpjMatch = cellValue.match(/Empresa:\s*(.+?)\s*-\s*CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/)
          if (empresaCnpjMatch) {
            empresa = empresaCnpjMatch[1].trim()
            cnpj = empresaCnpjMatch[2].trim()
            break
          }
          
          // Fallback para padrões individuais
          if (cellValue.includes("empresa") || cellValue.includes("razão")) {
            empresa = String(row[1] || row[0] || "").replace(/empresa:?/i, "").trim()
          }
          if (cellValue.includes("cnpj") || /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(cellValue)) {
            cnpj = String(row[1] || row[0] || "").replace(/cnpj:?/i, "").trim()
            // Extrair CNPJ se estiver na mesma célula
            const cnpjMatch = cnpj.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
            if (cnpjMatch) cnpj = cnpjMatch[0]
          }
        }
      }

      // Valores padrão se não encontrar
      if (!empresa) empresa = arquivo.name.replace('.xlsx', '').toUpperCase()
      if (!cnpj) cnpj = "00.000.000/0001-00"

      // Buscar data/período no conteúdo do arquivo
      let periodo = ""
      let mes = 0
      let ano = 0
      
      // Procurar por "Período: DD/MM/AAAA a DD/MM/AAAA"
      for (let i = 0; i < Math.min(15, jsonData.length); i++) {
        const row = jsonData[i] as any[]
        if (row && row.length > 0) {
          const cellValue = String(row[0] || "")
          const periodoMatch = cellValue.match(/Período:\s*(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/)
          if (periodoMatch) {
            const dataInicio = periodoMatch[1] // DD/MM/AAAA
            const [dia, mesStr, anoStr] = dataInicio.split('/')
            mes = parseInt(mesStr)
            ano = parseInt(anoStr)
            periodo = `${mesStr}/${anoStr}`
            break
          }
        }
      }
      
      // Fallback se não encontrar período
      if (!periodo) {
        const agora = new Date()
        mes = agora.getMonth() + 1
        ano = agora.getFullYear()
        periodo = `${mes.toString().padStart(2, '0')}/${ano}`
      }

      // Verificar se empresa existe nos clientes
      let { data: clienteExistente, error: clienteError } = await supabase
        .from('clients')
        .select('id')
        .eq('cnpj', cnpj)
        .maybeSingle()

      // Se não existir, criar automaticamente
      if (!clienteExistente && !clienteError) {
        const { error: insertError } = await supabase
          .from('clients')
          .insert({
            nome_empresarial: empresa,
            cnpj: cnpj,
            ramo_atividade: 'Não informado'
          })

        if (insertError) {
          console.error('Erro ao criar cliente:', insertError)
        }
      }

      // Buscar dados das contas (procurar header com "código", "conta", "saldo")
      let headerRowIndex = -1
      let codigoColIndex = -1
      let nomeColIndex = -1
      let saldoColIndex = -1

      console.log('🔍 Procurando colunas do balancete...')
      console.log('📊 Total de linhas no arquivo:', jsonData.length)
      
      for (let i = 0; i < Math.min(50, jsonData.length); i++) {
        const row = jsonData[i] as any[]
        if (row) {
          console.log(`Linha ${i}:`, row.slice(0, 10)) // Log das primeiras 10 colunas
          
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || "").toLowerCase()
            if (cell.includes("código") || cell.includes("codigo") || cell === "conta") {
              codigoColIndex = j
              headerRowIndex = i
              console.log(`✅ Coluna CÓDIGO encontrada na posição ${j}, linha ${i}`)
            }
            if (cell.includes("conta") || cell.includes("descrição") || cell.includes("descricao") || cell.includes("nome")) {
              nomeColIndex = j
              headerRowIndex = i
              console.log(`✅ Coluna NOME encontrada na posição ${j}, linha ${i}`)
            }
            if (cell.includes("saldo") && (cell.includes("atual") || cell.includes("final") || cell === "saldo")) {
              saldoColIndex = j
              headerRowIndex = i
              console.log(`✅ Coluna SALDO encontrada na posição ${j}, linha ${i}`)
            }
          }
          if (headerRowIndex >= 0 && codigoColIndex >= 0 && nomeColIndex >= 0 && saldoColIndex >= 0) {
            console.log(`🎯 Todas as colunas encontradas! Header na linha ${headerRowIndex}`)
            break
          }
        }
      }

      console.log('📈 Índices das colunas:')
      console.log(`- Código: ${codigoColIndex}`)
      console.log(`- Nome: ${nomeColIndex}`) 
      console.log(`- Saldo: ${saldoColIndex}`)
      console.log(`- Header na linha: ${headerRowIndex}`)

      // Extrair contas do balancete
      const contas = []
      if (headerRowIndex >= 0 && codigoColIndex >= 0 && nomeColIndex >= 0 && saldoColIndex >= 0) {
        console.log('🔄 Extraindo contas do balancete...')
        
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[]
          if (row && row.length > Math.max(codigoColIndex, nomeColIndex, saldoColIndex)) {
            const codigo = String(row[codigoColIndex] || "").trim()
            const nome = String(row[nomeColIndex] || "").trim()
            const saldoStr = String(row[saldoColIndex] || "0")
            
            if (codigo && nome) {
              // Converter saldo para número
              let saldo = 0
              let natureza = 'devedora'
              
              const saldoNumerico = parseFloat(saldoStr.replace(/[^\d,-]/g, '').replace(',', '.'))
              if (!isNaN(saldoNumerico)) {
                if (saldoNumerico < 0) {
                  saldo = Math.abs(saldoNumerico)
                  natureza = 'credora'
                } else {
                  saldo = saldoNumerico
                  natureza = 'devedora'
                }
              }

              contas.push({ codigo, nome, saldo, natureza })
              
              if (contas.length <= 5) {
                console.log(`Conta ${contas.length}: ${codigo} - ${nome} - R$ ${saldo} (${natureza})`)
              }
            }
          }
        }
        console.log(`✅ Total de contas extraídas: ${contas.length}`)
      } else {
        console.log('❌ Não foi possível encontrar todas as colunas necessárias')
      }

      // Verificar se já existe balancete do mesmo período e empresa
      const { data: balanceteExistente } = await supabase
        .from('balancetes')
        .select('id')
        .eq('cnpj', cnpj)
        .eq('periodo', periodo)
        .maybeSingle()

      // Se existir, excluir o balancete anterior e suas contas
      if (balanceteExistente) {
        await supabase
          .from('contas_balancete')
          .delete()
          .eq('balancete_id', balanceteExistente.id)

        await supabase
          .from('balancetes')
          .delete()
          .eq('id', balanceteExistente.id)
      }

      // Salvar balancete no banco
      const { data: balanceteData, error: balanceteError } = await supabase
        .from('balancetes')
        .insert({
          empresa,
          cnpj,
          periodo,
          ano,
          mes,
          arquivo_nome: arquivo.name,
          total_contas: contas.length,
          contas_parametrizadas: 0,
          status: 'pendente'
        })
        .select()
        .single()

      if (balanceteError) throw balanceteError

      // Salvar contas do balancete
      if (contas.length > 0) {
        const contasData = contas.map(conta => ({
          balancete_id: balanceteData.id,
          codigo: conta.codigo,
          nome: conta.nome,
          saldo_atual: conta.saldo,
          natureza: conta.natureza
        }))

        const { error: contasError } = await supabase
          .from('contas_balancete')
          .insert(contasData)

        if (contasError) throw contasError
      }

      // Recarregar lista
      await loadBalancetes()
      setArquivo(null)
      
      toast({
        title: "Balancete importado com sucesso",
        description: `${contas.length} contas foram processadas e estão prontas para parametrização`
      })
    } catch (error) {
      console.error('Erro na importação:', error)
      toast({
        title: "Erro na importação",
        description: "Ocorreu um erro ao processar o arquivo. Verifique o formato do arquivo.",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusBadge = (status: string, totalContas: number, contasParametrizadas: number) => {
    switch (status) {
      case 'parametrizado':
        return <Badge className="bg-green-100 text-green-800 border-green-200">100% Parametrizado</Badge>
      case 'parametrizando':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">{contasParametrizadas}/{totalContas}</Badge>
      case 'pendente':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Pendente</Badge>
      default:
        return <Badge variant="secondary">Desconhecido</Badge>
    }
  }

  const handleExcluir = async (id: string) => {
    try {
      const { error } = await supabase
        .from('balancetes')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadBalancetes()
      toast({
        title: "Balancete excluído",
        description: "O balancete foi removido com sucesso"
      })
    } catch (error) {
      console.error('Erro ao excluir balancete:', error)
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o balancete",
        variant: "destructive"
      })
    }
  }

  const balancetesFiltrados = balancetes.filter(balancete => {
    const matchEmpresa = !filtroEmpresa || balancete.empresa.toLowerCase().includes(filtroEmpresa.toLowerCase())
    const matchAno = filtroAno === "todos" || balancete.ano.toString() === filtroAno
    return matchEmpresa && matchAno
  })

  const anosDisponiveis = Array.from(new Set(balancetes.map(b => b.ano))).sort((a, b) => b - a)

  return (
    <div className="container mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importar Balancete</h1>
          <p className="text-muted-foreground">
            Faça upload de balancetes em formato .xlsx para análise e parametrização
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Balancete
          </CardTitle>
          <CardDescription>
            Selecione um arquivo .xlsx contendo o balancete para importação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                type="file"
                accept=".xlsx"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
            </div>
            <Button 
              onClick={handleImportarBalancete}
              disabled={!arquivo || isUploading}
              className="flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processando...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  Importar Balancete
                </>
              )}
            </Button>
          </div>
          {arquivo && (
            <p className="text-sm text-muted-foreground mt-2">
              Arquivo selecionado: {arquivo.name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Filtrar por empresa..."
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
              />
            </div>
            <Select value={filtroAno} onValueChange={setFiltroAno}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {anosDisponiveis.map(ano => (
                  <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Balancetes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Balancetes Importados</CardTitle>
          <CardDescription>
            Lista de todos os balancetes importados e seu status de parametrização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balancetesFiltrados.map((balancete) => (
                <TableRow key={balancete.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{balancete.empresa}</div>
                      <div className="text-sm text-muted-foreground font-normal">{balancete.cnpj}</div>
                    </div>
                  </TableCell>
                  <TableCell>{balancete.periodo}</TableCell>
                  <TableCell>
                    {getStatusBadge(balancete.status, balancete.totalContas, balancete.contasParametrizadas)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => navigate(`/indicadores/parametrizacao?balancete_id=${balancete.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Parametrizar
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir este balancete? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleExcluir(balancete.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}