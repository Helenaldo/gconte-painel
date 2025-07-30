import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Search, Users, Pencil, Eye, Download, Upload, Calendar as CalendarIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import InputMask from "react-input-mask"

interface Cliente {
  id: string
  cnpj: string
  nomeEmpresarial: string
  nomeFantasia: string
  ramoAtividade: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  clienteDesde: Date
  fimContrato: Date | null
}

const ramosAtividade = [
  "Comércio",
  "Serviço", 
  "Indústria",
  "Comércio e Serviço",
  "Indústria e Comércio"
]

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]

const mockClientes: Cliente[] = [
  {
    id: "1",
    cnpj: "12.345.678/0001-90",
    nomeEmpresarial: "Empresa ABC Ltda",
    nomeFantasia: "ABC",
    ramoAtividade: "Comércio",
    cep: "01234-567",
    logradouro: "Rua das Flores",
    numero: "123",
    complemento: "Sala 1",
    bairro: "Centro",
    municipio: "São Paulo",
    uf: "SP",
    clienteDesde: new Date(2020, 0, 15),
    fimContrato: null
  },
]

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>(mockClientes)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null)
  const [formData, setFormData] = useState({
    cnpj: "",
    nomeEmpresarial: "",
    nomeFantasia: "",
    ramoAtividade: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    municipio: "",
    uf: "",
    clienteDesde: undefined as Date | undefined,
    fimContrato: undefined as Date | undefined
  })
  const { toast } = useToast()

  const validateCNPJ = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, "")
    return cleaned.length === 14
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.cnpj || !formData.nomeEmpresarial || !formData.ramoAtividade || !formData.clienteDesde) {
      toast({
        title: "Erro",
        description: "CNPJ, Nome Empresarial, Ramo de Atividade e Cliente desde são obrigatórios",
        variant: "destructive"
      })
      return
    }

    if (!validateCNPJ(formData.cnpj)) {
      toast({
        title: "Erro",
        description: "CNPJ deve ter 14 dígitos",
        variant: "destructive"
      })
      return
    }

    // Verificar CNPJ duplicado
    const cnpjExists = clientes.some(cliente => 
      cliente.cnpj === formData.cnpj && cliente.id !== editingCliente?.id
    )
    
    if (cnpjExists) {
      toast({
        title: "Erro",
        description: "Não é possível cadastrar clientes com o mesmo CNPJ",
        variant: "destructive"
      })
      return
    }

    if (editingCliente) {
      setClientes(prev => prev.map(cliente => 
        cliente.id === editingCliente.id 
          ? { ...cliente, ...formData, clienteDesde: formData.clienteDesde!, fimContrato: formData.fimContrato || null }
          : cliente
      ))
      toast({ title: "Sucesso", description: "Cliente atualizado com sucesso" })
    } else {
      const novoCliente: Cliente = {
        id: Date.now().toString(),
        ...formData,
        clienteDesde: formData.clienteDesde!,
        fimContrato: formData.fimContrato || null
      }
      setClientes(prev => [...prev, novoCliente])
      toast({ title: "Sucesso", description: "Cliente cadastrado com sucesso" })
    }

    resetForm()
  }

  const resetForm = () => {
    setFormData({
      cnpj: "",
      nomeEmpresarial: "",
      nomeFantasia: "",
      ramoAtividade: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      municipio: "",
      uf: "",
      clienteDesde: undefined,
      fimContrato: undefined
    })
    setEditingCliente(null)
    setIsModalOpen(false)
  }

  const openEditModal = (cliente: Cliente) => {
    setFormData({
      cnpj: cliente.cnpj,
      nomeEmpresarial: cliente.nomeEmpresarial,
      nomeFantasia: cliente.nomeFantasia,
      ramoAtividade: cliente.ramoAtividade,
      cep: cliente.cep,
      logradouro: cliente.logradouro,
      numero: cliente.numero,
      complemento: cliente.complemento,
      bairro: cliente.bairro,
      municipio: cliente.municipio,
      uf: cliente.uf,
      clienteDesde: cliente.clienteDesde,
      fimContrato: cliente.fimContrato || undefined
    })
    setEditingCliente(cliente)
    setIsModalOpen(true)
  }

  const openViewModal = (cliente: Cliente) => {
    setViewingCliente(cliente)
  }

  const handleImportCSV = () => {
    toast({
      title: "Em desenvolvimento",
      description: "Funcionalidade de importação CSV será implementada em breve"
    })
  }

  const handleDownloadModel = () => {
    const csvContent = "CNPJ,Nome Empresarial,Nome Fantasia,Ramo de Atividade,CEP,Logradouro,Numero,Complemento,Bairro,Municipio,UF,Cliente Desde,Fim Contrato\n"
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-clientes.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os clientes do escritório
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadModel}>
            <Download className="mr-2 h-4 w-4" />
            Baixar CSV Modelo
          </Button>
          <Button variant="outline" onClick={handleImportCSV}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90" onClick={() => setEditingCliente(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <InputMask
                      mask="99.999.999/9999-99"
                      value={formData.cnpj}
                      onChange={(e) => setFormData(prev => ({...prev, cnpj: e.target.value}))}
                    >
                      <Input placeholder="00.000.000/0000-00" />
                    </InputMask>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ramoAtividade">Ramo de Atividade *</Label>
                    <Select 
                      value={formData.ramoAtividade} 
                      onValueChange={(value) => setFormData(prev => ({...prev, ramoAtividade: value}))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o ramo" />
                      </SelectTrigger>
                      <SelectContent>
                        {ramosAtividade.map(ramo => (
                          <SelectItem key={ramo} value={ramo}>
                            {ramo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="nomeEmpresarial">Nome Empresarial *</Label>
                    <Input
                      id="nomeEmpresarial"
                      value={formData.nomeEmpresarial}
                      onChange={(e) => setFormData(prev => ({...prev, nomeEmpresarial: e.target.value}))}
                      placeholder="Nome empresarial"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                    <Input
                      id="nomeFantasia"
                      value={formData.nomeFantasia}
                      onChange={(e) => setFormData(prev => ({...prev, nomeFantasia: e.target.value}))}
                      placeholder="Nome fantasia"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <InputMask
                      mask="99999-999"
                      value={formData.cep}
                      onChange={(e) => setFormData(prev => ({...prev, cep: e.target.value}))}
                    >
                      <Input placeholder="00000-000" />
                    </InputMask>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logradouro">Logradouro</Label>
                    <Input
                      id="logradouro"
                      value={formData.logradouro}
                      onChange={(e) => setFormData(prev => ({...prev, logradouro: e.target.value}))}
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      value={formData.numero}
                      onChange={(e) => setFormData(prev => ({...prev, numero: e.target.value}))}
                      placeholder="123"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input
                      id="complemento"
                      value={formData.complemento}
                      onChange={(e) => setFormData(prev => ({...prev, complemento: e.target.value}))}
                      placeholder="Sala, Andar, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={formData.bairro}
                      onChange={(e) => setFormData(prev => ({...prev, bairro: e.target.value}))}
                      placeholder="Nome do bairro"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="municipio">Município</Label>
                    <Input
                      id="municipio"
                      value={formData.municipio}
                      onChange={(e) => setFormData(prev => ({...prev, municipio: e.target.value}))}
                      placeholder="Nome da cidade"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="uf">UF</Label>
                    <Select 
                      value={formData.uf} 
                      onValueChange={(value) => setFormData(prev => ({...prev, uf: value}))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {estadosBrasil.map(estado => (
                          <SelectItem key={estado} value={estado}>
                            {estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cliente desde *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.clienteDesde && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.clienteDesde ? format(formData.clienteDesde, "PPP", { locale: ptBR }) : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.clienteDesde}
                          onSelect={(date) => setFormData(prev => ({...prev, clienteDesde: date}))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Fim do contrato</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.fimContrato && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.fimContrato ? format(formData.fimContrato, "PPP", { locale: ptBR }) : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.fimContrato}
                          onSelect={(date) => setFormData(prev => ({...prev, fimContrato: date}))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-primary hover:opacity-90">
                    {editingCliente ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Use os filtros para encontrar clientes específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou CNPJ..." className="pl-10" />
              </div>
            </div>
            <Button variant="outline">Filtrar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            {clientes.length} cliente(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum cliente cadastrado</p>
              <p className="text-sm">Clique em "Novo Cliente" para adicionar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {clientes.map((cliente) => (
                <div key={cliente.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{cliente.nomeEmpresarial}</h4>
                    {cliente.nomeFantasia && (
                      <p className="text-sm text-muted-foreground">{cliente.nomeFantasia}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {cliente.cnpj} • {cliente.ramoAtividade}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Cliente desde: {format(cliente.clienteDesde, "PPP", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openViewModal(cliente)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(cliente)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Visualização */}
      <Dialog open={!!viewingCliente} onOpenChange={() => setViewingCliente(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          
          {viewingCliente && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">CNPJ</Label>
                  <p className="mt-1">{viewingCliente.cnpj}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Ramo de Atividade</Label>
                  <p className="mt-1">{viewingCliente.ramoAtividade}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Nome Empresarial</Label>
                  <p className="mt-1">{viewingCliente.nomeEmpresarial}</p>
                </div>
                {viewingCliente.nomeFantasia && (
                  <div className="col-span-2">
                    <Label className="text-sm font-medium text-muted-foreground">Nome Fantasia</Label>
                    <p className="mt-1">{viewingCliente.nomeFantasia}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Endereço</Label>
                  <p className="mt-1">
                    {[viewingCliente.logradouro, viewingCliente.numero].filter(Boolean).join(", ")}
                    {viewingCliente.complemento && `, ${viewingCliente.complemento}`}
                  </p>
                  <p>
                    {[viewingCliente.bairro, viewingCliente.municipio, viewingCliente.uf].filter(Boolean).join(" - ")}
                  </p>
                  {viewingCliente.cep && <p>CEP: {viewingCliente.cep}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Cliente desde</Label>
                  <p className="mt-1">{format(viewingCliente.clienteDesde, "PPP", { locale: ptBR })}</p>
                </div>
                {viewingCliente.fimContrato && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Fim do contrato</Label>
                    <p className="mt-1">{format(viewingCliente.fimContrato, "PPP", { locale: ptBR })}</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between pt-4">
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Imprimir PDF
                </Button>
                <Button onClick={() => setViewingCliente(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}