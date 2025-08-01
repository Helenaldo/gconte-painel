import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Download, Mail, Phone, Calendar, FileText, Printer } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import jsPDF from 'jspdf'

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

interface Office {
  id: string
  nome: string
  cnpj: string
  telefone: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  instagram: string
  logomarca_url: string
}

interface ClienteDetailsProps {
  cliente: Cliente
}

export function ClienteDetails({ cliente }: ClienteDetailsProps) {
  const [contatos, setContatos] = useState<Contato[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tributacoes, setTributacoes] = useState<Tributacao[]>([])
  const [office, setOffice] = useState<Office | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const loadClienteData = async () => {
      try {
        setLoading(true)
        
        // Carregar dados do escritório
        const { data: officeData } = await supabase
          .from('office')
          .select('*')
          .limit(1)
          .single()
        
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
        
        setOffice(officeData)
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

  const handlePrintPDF = async () => {
    try {
      const pdf = new jsPDF()
      let yPosition = 20

      // Cabeçalho do escritório
      if (office) {
        // Título do escritório
        pdf.setFontSize(16)
        pdf.setFont("helvetica", "bold")
        pdf.text(office.nome, 20, yPosition)
        yPosition += 10

        // CNPJ do escritório
        pdf.setFontSize(10)
        pdf.setFont("helvetica", "normal")
        pdf.text(`CNPJ: ${office.cnpj}`, 20, yPosition)
        yPosition += 8

        // Endereço do escritório
        const enderecoEscritorio = [
          office.logradouro,
          office.numero,
          office.complemento
        ].filter(Boolean).join(", ")
        
        if (enderecoEscritorio) {
          pdf.text(enderecoEscritorio, 20, yPosition)
          yPosition += 6
        }

        const cidadeEscritorio = [
          office.bairro,
          office.municipio,
          office.uf
        ].filter(Boolean).join(" - ")
        
        if (cidadeEscritorio) {
          pdf.text(cidadeEscritorio, 20, yPosition)
          yPosition += 6
        }

        if (office.cep) {
          pdf.text(`CEP: ${office.cep}`, 20, yPosition)
          yPosition += 6
        }

        if (office.telefone) {
          pdf.text(`Telefone: ${office.telefone}`, 20, yPosition)
          yPosition += 6
        }

        // Linha separadora
        yPosition += 5
        pdf.line(20, yPosition, 190, yPosition)
        yPosition += 15
      }

      // Título do relatório
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.text("RELATÓRIO DO CLIENTE", 20, yPosition)
      yPosition += 15

      // Dados do cliente
      pdf.setFontSize(12)
      pdf.setFont("helvetica", "bold")
      pdf.text("DADOS DO CLIENTE", 20, yPosition)
      yPosition += 10

      pdf.setFontSize(10)
      pdf.setFont("helvetica", "normal")
      
      pdf.text(`Nome Empresarial: ${cliente.nome_empresarial}`, 20, yPosition)
      yPosition += 6
      
      if (cliente.nome_fantasia) {
        pdf.text(`Nome Fantasia: ${cliente.nome_fantasia}`, 20, yPosition)
        yPosition += 6
      }
      
      pdf.text(`CNPJ: ${cliente.cnpj}`, 20, yPosition)
      yPosition += 6
      
      pdf.text(`Ramo de Atividade: ${cliente.ramo_atividade}`, 20, yPosition)
      yPosition += 6

      // Endereço do cliente
      const enderecoCliente = [
        cliente.logradouro,
        cliente.numero,
        cliente.complemento
      ].filter(Boolean).join(", ")
      
      if (enderecoCliente) {
        pdf.text(`Endereço: ${enderecoCliente}`, 20, yPosition)
        yPosition += 6
      }

      const cidadeCliente = [
        cliente.bairro,
        cliente.municipio,
        cliente.uf
      ].filter(Boolean).join(" - ")
      
      if (cidadeCliente) {
        pdf.text(`Cidade: ${cidadeCliente}`, 20, yPosition)
        yPosition += 6
      }

      if (cliente.cep) {
        pdf.text(`CEP: ${cliente.cep}`, 20, yPosition)
        yPosition += 6
      }

      pdf.text(`Cliente desde: ${format(new Date(cliente.cliente_desde), "PPP", { locale: ptBR })}`, 20, yPosition)
      yPosition += 6

      if (cliente.fim_contrato) {
        pdf.text(`Fim do contrato: ${format(new Date(cliente.fim_contrato), "PPP", { locale: ptBR })}`, 20, yPosition)
        yPosition += 6
      }

      yPosition += 10

      // Contatos
      if (contatos.length > 0) {
        if (yPosition > 250) {
          pdf.addPage()
          yPosition = 20
        }

        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        pdf.text("CONTATOS", 20, yPosition)
        yPosition += 10

        pdf.setFontSize(10)
        pdf.setFont("helvetica", "normal")

        contatos.forEach((contato) => {
          if (yPosition > 270) {
            pdf.addPage()
            yPosition = 20
          }
          
          pdf.text(`• ${contato.nome}`, 25, yPosition)
          yPosition += 6
          pdf.text(`  Email: ${contato.email}`, 25, yPosition)
          yPosition += 6
          pdf.text(`  Telefone: ${contato.telefone}`, 25, yPosition)
          yPosition += 8
        })
      }

      // Eventos
      if (eventos.length > 0) {
        if (yPosition > 200) {
          pdf.addPage()
          yPosition = 20
        }

        yPosition += 5
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        pdf.text("EVENTOS", 20, yPosition)
        yPosition += 10

        pdf.setFontSize(10)
        pdf.setFont("helvetica", "normal")

        eventos.forEach((evento) => {
          if (yPosition > 260) {
            pdf.addPage()
            yPosition = 20
          }
          
          pdf.text(`• ${evento.titulo} (${evento.setor})`, 25, yPosition)
          yPosition += 6
          pdf.text(`  Data: ${format(new Date(evento.data), "PPP", { locale: ptBR })}`, 25, yPosition)
          yPosition += 6
          if (evento.descricao) {
            pdf.text(`  Descrição: ${evento.descricao}`, 25, yPosition)
            yPosition += 6
          }
          yPosition += 3
        })
      }

      // Tributações
      if (tributacoes.length > 0) {
        if (yPosition > 200) {
          pdf.addPage()
          yPosition = 20
        }

        yPosition += 5
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        pdf.text("HISTÓRICO DE TRIBUTAÇÃO", 20, yPosition)
        yPosition += 10

        pdf.setFontSize(10)
        pdf.setFont("helvetica", "normal")

        tributacoes.forEach((tributacao) => {
          if (yPosition > 270) {
            pdf.addPage()
            yPosition = 20
          }
          
          pdf.text(`• ${tributacao.tipo} - ${tributacao.status.toUpperCase()}`, 25, yPosition)
          yPosition += 6
          pdf.text(`  Data: ${format(new Date(tributacao.data), "PPP", { locale: ptBR })}`, 25, yPosition)
          yPosition += 8
        })
      }

      // Rodapé
      const pageCount = pdf.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "normal")
        pdf.text(`Página ${i} de ${pageCount}`, 20, 285)
        pdf.text(`Relatório gerado em ${format(new Date(), "PPpp", { locale: ptBR })}`, 120, 285)
      }

      // Salvar o PDF
      pdf.save(`relatorio-cliente-${cliente.nome_empresarial.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`)

      toast({
        title: "Sucesso",
        description: "PDF gerado com sucesso!"
      })
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      toast({
        title: "Erro",
        description: "Erro ao gerar PDF",
        variant: "destructive"
      })
    }
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