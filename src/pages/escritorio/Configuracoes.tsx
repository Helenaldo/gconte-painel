import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Settings, Pencil, Building2, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import InputMask from "react-input-mask"

interface Escritorio {
  id: string
  nome: string
  cnpj: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cep: string
  municipio: string
  uf: string
  telefone: string
  instagram: string
  logomarca: string | null
}

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]

export function Configuracoes() {
  const [escritorio, setEscritorio] = useState<Escritorio | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cep: "",
    municipio: "",
    uf: "",
    telefone: "",
    instagram: "",
    logomarca: null as File | null
  })
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nome || !formData.cnpj || !formData.cep || !formData.telefone) {
      toast({
        title: "Erro",
        description: "Nome, CNPJ, CEP e Telefone são obrigatórios",
        variant: "destructive"
      })
      return
    }

    const novoEscritorio: Escritorio = {
      id: escritorio?.id || "1",
      ...formData,
      logomarca: formData.logomarca ? URL.createObjectURL(formData.logomarca) : escritorio?.logomarca || null
    }

    setEscritorio(novoEscritorio)
    setIsModalOpen(false)
    toast({ 
      title: "Sucesso", 
      description: escritorio ? "Configurações atualizadas com sucesso" : "Escritório cadastrado com sucesso"
    })
  }

  const openEditModal = () => {
    if (escritorio) {
      setFormData({
        nome: escritorio.nome,
        cnpj: escritorio.cnpj,
        logradouro: escritorio.logradouro,
        numero: escritorio.numero,
        complemento: escritorio.complemento,
        bairro: escritorio.bairro,
        cep: escritorio.cep,
        municipio: escritorio.municipio,
        uf: escritorio.uf,
        telefone: escritorio.telefone,
        instagram: escritorio.instagram,
        logomarca: null
      })
    } else {
      setFormData({
        nome: "",
        cnpj: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cep: "",
        municipio: "",
        uf: "",
        telefone: "",
        instagram: "",
        logomarca: null
      })
    }
    setIsModalOpen(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData(prev => ({ ...prev, logomarca: file }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie as configurações do escritório
          </p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90" onClick={openEditModal}>
              {escritorio ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar Escritório
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Escritório
                </>
              )}
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{escritorio ? "Editar Escritório" : "Cadastrar Escritório"}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({...prev, nome: e.target.value}))}
                    placeholder="Nome do escritório"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <InputMask
                    mask="99.999.999/9999-99"
                    value={formData.cnpj}
                    onChange={(e) => setFormData(prev => ({...prev, cnpj: e.target.value}))}
                  >
                    {() => <Input placeholder="00.000.000/0000-00" />}
                  </InputMask>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={formData.telefone}
                    onChange={(e) => setFormData(prev => ({...prev, telefone: e.target.value}))}
                  >
                    {() => <Input placeholder="(11) 99999-9999" />}
                  </InputMask>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cep">CEP *</Label>
                  <InputMask
                    mask="99999-999"
                    value={formData.cep}
                    onChange={(e) => setFormData(prev => ({...prev, cep: e.target.value}))}
                  >
                    {() => <Input placeholder="00000-000" />}
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
                      <SelectValue placeholder="Selecione o estado" />
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

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={formData.instagram}
                    onChange={(e) => setFormData(prev => ({...prev, instagram: e.target.value}))}
                    placeholder="@usuario"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="logomarca">Logomarca</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="logomarca"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="flex-1"
                    />
                    {(formData.logomarca || escritorio?.logomarca) && (
                      <Avatar className="h-12 w-12">
                        <AvatarImage 
                          src={formData.logomarca ? URL.createObjectURL(formData.logomarca) : escritorio?.logomarca || ""} 
                          alt="Logomarca" 
                        />
                        <AvatarFallback><Building2 className="h-6 w-6" /></AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-primary hover:opacity-90">
                  {escritorio ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {escritorio ? (
        <Card>
          <CardHeader>
            <CardTitle>Dados do Escritório</CardTitle>
            <CardDescription>
              Informações do escritório cadastrado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={escritorio.logomarca || ""} alt="Logomarca" />
                    <AvatarFallback><Building2 className="h-8 w-8" /></AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{escritorio.nome}</h3>
                    <p className="text-sm text-muted-foreground">CNPJ: {escritorio.cnpj}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Endereço</Label>
                  <p className="mt-1">
                    {[escritorio.logradouro, escritorio.numero].filter(Boolean).join(", ")}
                    {escritorio.complemento && `, ${escritorio.complemento}`}
                  </p>
                  <p>
                    {[escritorio.bairro, escritorio.municipio, escritorio.uf].filter(Boolean).join(" - ")}
                  </p>
                  <p>CEP: {escritorio.cep}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Contato</Label>
                  <p className="mt-1">Telefone: {escritorio.telefone}</p>
                  {escritorio.instagram && <p>Instagram: {escritorio.instagram}</p>}
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={openEditModal}
                  className="w-full md:w-auto"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar Informações
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum escritório cadastrado</h3>
            <p className="text-muted-foreground text-center mb-6">
              Configure os dados do seu escritório para personalizar o sistema
            </p>
            <Button onClick={openEditModal} className="bg-gradient-primary hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Escritório
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}