import { useState } from "react"
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
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [balancetes, setBalancetes] = useState<BalanceteImportado[]>([
    {
      id: "1",
      empresa: "EMPRESA EXEMPLO LTDA",
      cnpj: "12.345.678/0001-90",
      periodo: "12/2023",
      ano: 2023,
      status: "parametrizado",
      totalContas: 30,
      contasParametrizadas: 30,
      dataImportacao: new Date()
    },
    {
      id: "2", 
      empresa: "COMÉRCIO ABC LTDA",
      cnpj: "98.765.432/0001-10",
      periodo: "11/2023",
      ano: 2023,
      status: "parametrizando",
      totalContas: 25,
      contasParametrizadas: 12,
      dataImportacao: new Date()
    },
    {
      id: "3",
      empresa: "SERVIÇOS XYZ LTDA", 
      cnpj: "11.222.333/0001-44",
      periodo: "10/2023",
      ano: 2023,
      status: "pendente",
      totalContas: 18,
      contasParametrizadas: 0,
      dataImportacao: new Date()
    }
  ])
  const [filtroEmpresa, setFiltroEmpresa] = useState("")
  const [filtroAno, setFiltroAno] = useState("todos")
  const { toast } = useToast()

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
      // Simular processamento do arquivo
      const data = await arquivo.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      
      // Aqui você implementaria a lógica de leitura do balancete
      // Por enquanto, vamos simular
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const novoBalancete: BalanceteImportado = {
        id: Date.now().toString(),
        empresa: "NOVA EMPRESA LTDA",
        cnpj: "55.666.777/0001-88",
        periodo: "01/2024",
        ano: 2024,
        status: "pendente",
        totalContas: 28,
        contasParametrizadas: 0,
        dataImportacao: new Date()
      }
      
      setBalancetes(prev => [novoBalancete, ...prev])
      setArquivo(null)
      
      toast({
        title: "Balancete importado com sucesso",
        description: "O balancete foi processado e está pronto para parametrização"
      })
    } catch (error) {
      toast({
        title: "Erro na importação",
        description: "Ocorreu um erro ao processar o arquivo",
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

  const handleExcluir = (id: string) => {
    setBalancetes(prev => prev.filter(b => b.id !== id))
    toast({
      title: "Balancete excluído",
      description: "O balancete foi removido com sucesso"
    })
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
                <TableHead>CNPJ</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Importação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balancetesFiltrados.map((balancete) => (
                <TableRow key={balancete.id}>
                  <TableCell className="font-medium">{balancete.empresa}</TableCell>
                  <TableCell>{balancete.cnpj}</TableCell>
                  <TableCell>{balancete.periodo}</TableCell>
                  <TableCell>
                    {getStatusBadge(balancete.status, balancete.totalContas, balancete.contasParametrizadas)}
                  </TableCell>
                  <TableCell>{balancete.dataImportacao.toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
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