import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Download, Mail, Phone, Calendar, FileText } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { supabase } from "@/integrations/supabase/client"

interface Cliente {
  id: string
  cnpj: string
  nome_empresarial: string
  nome_fantasia: string
  ramo_atividade: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cliente_desde: string
  fim_contrato: string | null
}

interface Contato {
  id: string
  nome: string
  email: string
  telefone: string
  created_at: string
}

interface Evento {
  id: string
  titulo: string
  descricao: string
  data: string
  setor: string
  created_at: string
}

interface Tributacao {
  id: string
  tipo: string
  data: string
  status: string
  created_at: string
}

interface ClienteDetailsProps {
  cliente: Cliente
}

export function ClienteDetails({ cliente }: ClienteDetailsProps) {
  const [contatos, setContatos] = useState<Contato[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tributacoes, setTributacoes] = useState<Tributacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadClienteData = async () => {
      try {
        setLoading(true)
        
        // Carregar contatos
        const { data: contatosData } = await supabase
          .from('contacts')
          .select('*')
          .eq('client_id', cliente.id)
          .order('created_at', { ascending: false })
        
        // Carregar eventos
        const { data: eventosData } = await supabase
          .from('events')
          .select('*')
          .eq('client_id', cliente.id)
          .order('data', { ascending: false })
        
        // Carregar tributações
        const { data: tributacoesData } = await supabase
          .from('taxation')
          .select('*')
          .eq('client_id', cliente.id)
          .order('data', { ascending: false })
        
        setContatos(contatosData || [])
        setEventos(eventosData || [])
        setTributacoes(tributacoesData || [])
      } catch (error) {
        console.error('Erro ao carregar dados do cliente:', error)
      } finally {
        setLoading(false)
      }
    }

    loadClienteData()
  }, [cliente.id])

  const handlePrintPDF = () => {
    // Implementar geração de PDF futuramente
    console.log('Imprimir PDF do cliente', cliente.id)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Informações básicas do cliente */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">{cliente.nome_empresarial}</CardTitle>
              {cliente.nome_fantasia && (
                <p className="text-muted-foreground mt-1">{cliente.nome_fantasia}</p>
              )}
            </div>
            {cliente.fim_contrato && (
              <Badge variant="destructive">Inativo</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">CNPJ</Label>
              <p className="mt-1">{cliente.cnpj}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Ramo de Atividade</Label>
              <p className="mt-1">{cliente.ramo_atividade}</p>
            </div>
            <div className="col-span-2">
              <Label className="text-sm font-medium text-muted-foreground">Endereço</Label>
              <p className="mt-1">
                {[cliente.logradouro, cliente.numero].filter(Boolean).join(", ")}
                {cliente.complemento && `, ${cliente.complemento}`}
              </p>
              <p>
                {[cliente.bairro, cliente.municipio, cliente.uf].filter(Boolean).join(" - ")}
              </p>
              {cliente.cep && <p>CEP: {cliente.cep}</p>}
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Cliente desde</Label>
              <p className="mt-1">{format(new Date(cliente.cliente_desde), "PPP", { locale: ptBR })}</p>
            </div>
            {cliente.fim_contrato && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Fim do contrato</Label>
                <p className="mt-1">{format(new Date(cliente.fim_contrato), "PPP", { locale: ptBR })}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs com relacionamentos */}
      <Tabs defaultValue="contatos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contatos" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Contatos ({contatos.length})
          </TabsTrigger>
          <TabsTrigger value="eventos" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Eventos ({eventos.length})
          </TabsTrigger>
          <TabsTrigger value="tributacao" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Tributação ({tributacoes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contatos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contatos</CardTitle>
            </CardHeader>
            <CardContent>
              {contatos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum contato cadastrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contatos.map((contato) => (
                    <div key={contato.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{contato.nome}</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {contato.email}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {contato.telefone}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Cadastrado em {format(new Date(contato.created_at), "PPp", { locale: ptBR })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eventos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Eventos</CardTitle>
            </CardHeader>
            <CardContent>
              {eventos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum evento cadastrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {eventos.map((evento) => (
                    <div key={evento.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{evento.titulo}</h4>
                        <Badge variant="outline">{evento.setor}</Badge>
                      </div>
                      {evento.descricao && (
                        <p className="text-sm text-muted-foreground mb-2">{evento.descricao}</p>
                      )}
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Data: {format(new Date(evento.data), "PPP", { locale: ptBR })}</span>
                        <span>Criado em {format(new Date(evento.created_at), "PPp", { locale: ptBR })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tributacao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Tributação</CardTitle>
            </CardHeader>
            <CardContent>
              {tributacoes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma tributação cadastrada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tributacoes.map((tributacao) => (
                    <div key={tributacao.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{tributacao.tipo}</h4>
                        <p className="text-sm text-muted-foreground">
                          Data: {format(new Date(tributacao.data), "PPP", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={tributacao.status === 'ativa' ? 'default' : 'secondary'}>
                          {tributacao.status === 'ativa' ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Cadastrado em {format(new Date(tributacao.created_at), "PPp", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Botão de ações */}
      <div className="flex justify-end pt-4">
        <Button variant="outline" onClick={handlePrintPDF}>
          <Download className="mr-2 h-4 w-4" />
          Imprimir PDF
        </Button>
      </div>
    </div>
  )
}