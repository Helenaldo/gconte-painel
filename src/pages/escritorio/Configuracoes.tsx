import { useState, useEffect } from "react"
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
import { supabase } from "@/integrations/supabase/client"

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
  email: string
  instagram: string
  logomarca_url: string | null
  recaptcha_site_key: string | null
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
    email: "",
    instagram: "",
    recaptcha_site_key: "",
    logomarca: null as File | null
  })
  const { toast } = useToast()

  // Carregar dados do escritório
  useEffect(() => {
    loadEscritorio()
  }, [])

  const loadEscritorio = async () => {
    try {
      const { data, error } = await supabase
        .from('office')
        .select('*')
        .single()
      
      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar escritório:', error)
        return
      }
      
      if (data) {
        setEscritorio(data)
      }
    } catch (error) {
      console.error('Erro ao carregar escritório:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nome || !formData.cnpj || !formData.cep || !formData.telefone) {
      toast({
        title: "Erro",
        description: "Nome, CNPJ, CEP e Telefone são obrigatórios",
        variant: "destructive"
      })
      return
    }

    try {
      let logomarcaUrl = escritorio?.logomarca_url || null

      // Upload da logomarca se houver uma nova
      if (formData.logomarca) {
        // Remove logomarca antiga se existir
        if (escritorio?.logomarca_url) {
          const oldPath = escritorio.logomarca_url.split('/').pop()
          if (oldPath) {
            await supabase.storage
              .from('office-logos')
              .remove([oldPath])
          }
        }

        // Upload da nova logomarca
        const fileExt = formData.logomarca.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('office-logos')
          .upload(fileName, formData.logomarca)

        if (uploadError) {
          throw new Error(`Erro no upload da logomarca: ${uploadError.message}`)
        }

        // Obter URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('office-logos')
          .getPublicUrl(fileName)

        logomarcaUrl = publicUrl
      }

      const escritorioData = {
        nome: formData.nome,
        cnpj: formData.cnpj,
        logradouro: formData.logradouro || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        bairro: formData.bairro || null,
        cep: formData.cep,
        municipio: formData.municipio || null,
        uf: formData.uf || null,
        telefone: formData.telefone,
        email: formData.email || null,
        instagram: formData.instagram || null,
        recaptcha_site_key: formData.recaptcha_site_key || null,
        logomarca_url: logomarcaUrl
      }

      if (escritorio) {
        const { error } = await supabase
          .from('office')
          .update(escritorioData)
          .eq('id', escritorio.id)
        
        if (error) throw error
        toast({ title: "Sucesso", description: "Configurações atualizadas com sucesso" })
      } else {
        const { error } = await supabase
          .from('office')
          .insert([escritorioData])
        
        if (error) throw error
        toast({ title: "Sucesso", description: "Escritório cadastrado com sucesso" })
      }

      await loadEscritorio()
      setIsModalOpen(false)
    } catch (error: any) {
      console.error('Erro ao salvar escritório:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar escritório",
        variant: "destructive"
      })
    }
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
        email: escritorio.email,
        instagram: escritorio.instagram,
        recaptcha_site_key: escritorio.recaptcha_site_key || "",
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
        email: "",
        instagram: "",
        recaptcha_site_key: "",
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
                    mask={formData.telefone.replace(/\D/g, '').length === 11 ? "(99) 99999-9999" : "(99) 9999-9999"}
                    value={formData.telefone}
                    onChange={(e) => setFormData(prev => ({...prev, telefone: e.target.value}))}
                  >
                    {() => <Input placeholder="(11) 99999-9999 ou (11) 9999-9999" />}
                  </InputMask>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                    placeholder="contato@escritorio.com"
                  />
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
                  <Label htmlFor="recaptcha_site_key">Chave do Site reCAPTCHA</Label>
                  <Input
                    id="recaptcha_site_key"
                    value={formData.recaptcha_site_key}
                    onChange={(e) => setFormData(prev => ({...prev, recaptcha_site_key: e.target.value}))}
                    placeholder="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                  />
                  <p className="text-xs text-muted-foreground">
                    Configure sua chave do reCAPTCHA v2 no <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google reCAPTCHA</a>
                  </p>
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
                    {(formData.logomarca || escritorio?.logomarca_url) && (
                      <Avatar className="h-12 w-12">
                        <AvatarImage 
                          src={formData.logomarca ? URL.createObjectURL(formData.logomarca) : escritorio?.logomarca_url || ""} 
                          alt="Logomarca"
                          className="object-contain"
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
        <>
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
                      <AvatarImage src={escritorio.logomarca_url || ""} alt="Logomarca" className="object-contain" />
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
                    {escritorio.email && <p>E-mail: {escritorio.email}</p>}
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

          {/* Card de configuração do reCAPTCHA */}
          {escritorio.recaptcha_site_key && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuração do reCAPTCHA
                </CardTitle>
                <CardDescription>
                  Configure os domínios autorizados no Google reCAPTCHA Console
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Domínio atual detectado:</h4>
                  <code className="text-sm bg-background p-2 rounded border">
                    {window.location.hostname}
                  </code>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Domínios que devem ser configurados no reCAPTCHA:</h4>
                  <div className="space-y-2">
                    {[
                      'localhost',
                      '127.0.0.1',
                      window.location.hostname,
                      'seu-dominio-producao.com'
                    ].filter((domain, index, arr) => arr.indexOf(domain) === index).map((domain, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                        <code className="bg-background p-1 rounded border">{domain}</code>
                        {domain === 'seu-dominio-producao.com' && (
                          <span className="text-muted-foreground">(substitua pelo seu domínio real)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-2">Como configurar:</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>1. Acesse o <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google reCAPTCHA Console</a></li>
                    <li>2. Clique na sua chave: <code className="bg-background p-1 rounded border text-xs">{escritorio.recaptcha_site_key}</code></li>
                    <li>3. Vá em "Configurações" → "Domínios"</li>
                    <li>4. Adicione todos os domínios listados acima</li>
                    <li>5. Salve as alterações</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(escritorio.recaptcha_site_key!)
                      toast({
                        title: "Copiado!",
                        description: "Chave do reCAPTCHA copiada para a área de transferência"
                      })
                    }}
                  >
                    Copiar Chave
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    asChild
                  >
                    <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer">
                      Abrir Console
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
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