import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/context/auth-context"

interface Client {
  id: string
  nome_empresarial: string
  cnpj: string
}

interface Collaborator {
  id: string
  nome: string
  email: string
}

interface TransferirModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Client[]
  collaborators: Collaborator[]
  onSave: () => void
}

export function TransferirModal({ 
  open, 
  onOpenChange, 
  clients, 
  collaborators, 
  onSave 
}: TransferirModalProps) {
  const [loading, setLoading] = useState(false)
  const [colaboradorOrigemOpen, setColaboradorOrigemOpen] = useState(false)
  const [colaboradorDestinoOpen, setColaboradorDestinoOpen] = useState(false)
  const [empresaOpen, setEmpresaOpen] = useState(false)
  const [formData, setFormData] = useState({
    colaborador_origem_id: "",
    colaborador_destino_id: "",
    tipo_transferencia: "todas", // "todas" ou "uma"
    empresa_id: "",
    data_inicio: undefined as Date | undefined
  })
  
  const { profile } = useAuth()
  const { toast } = useToast()

  const resetForm = () => {
    setFormData({
      colaborador_origem_id: "",
      colaborador_destino_id: "",
      tipo_transferencia: "todas",
      empresa_id: "",
      data_inicio: undefined
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.colaborador_origem_id || !formData.colaborador_destino_id || !formData.data_inicio) {
      toast({
        title: "Erro",
        description: "Colaborador Origem, Colaborador Destino e Data de Início são obrigatórios",
        variant: "destructive"
      })
      return
    }

    if (formData.tipo_transferencia === "uma" && !formData.empresa_id) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa para transferência específica",
        variant: "destructive"
      })
      return
    }

    if (formData.colaborador_origem_id === formData.colaborador_destino_id) {
      toast({
        title: "Erro",
        description: "Colaborador de origem e destino devem ser diferentes",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      // Buscar vínculos vigentes do colaborador origem
      let query = supabase
        .from('responsible_assignments')
        .select('*')
        .eq('collaborator_id', formData.colaborador_origem_id)
        .eq('status', 'vigente')

      if (formData.tipo_transferencia === "uma") {
        query = query.eq('client_id', formData.empresa_id)
      }

      const { data: vinculos, error: fetchError } = await query

      if (fetchError) throw fetchError

      if (!vinculos || vinculos.length === 0) {
        toast({
          title: "Aviso",
          description: "Nenhum vínculo vigente encontrado para transferir",
          variant: "destructive"
        })
        return
      }

      const dataInicio = formData.data_inicio.toISOString().split('T')[0]

      // Encerrar vínculos antigos
      const { error: updateError } = await supabase
        .from('responsible_assignments')
        .update({
          data_fim: dataInicio,
          status: 'encerrado',
          ended_by: profile?.id,
          ended_at: new Date().toISOString()
        })
        .in('id', vinculos.map(v => v.id))

      if (updateError) throw updateError

      // Criar novos vínculos
      const novosVinculos = vinculos.map(vinculo => ({
        client_id: vinculo.client_id,
        collaborator_id: formData.colaborador_destino_id,
        setores: vinculo.setores,
        data_inicio: dataInicio,
        data_fim: null,
        created_by: profile?.id
      }))

      const { error: insertError } = await supabase
        .from('responsible_assignments')
        .insert(novosVinculos)

      if (insertError) throw insertError

      toast({
        title: "Sucesso",
        description: `Responsabilidades transferidas com sucesso (${vinculos.length} vínculo${vinculos.length > 1 ? 's' : ''})`
      })

      onSave()
      onOpenChange(false)
      resetForm()
    } catch (error: any) {
      console.error('Erro ao transferir responsabilidades:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao transferir responsabilidades",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const colaboradorOrigem = collaborators.find(c => c.id === formData.colaborador_origem_id)
  const colaboradorDestino = collaborators.find(c => c.id === formData.colaborador_destino_id)
  const empresaSelecionada = clients.find(c => c.id === formData.empresa_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transferir Responsabilidades</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Colaborador Origem */}
            <div className="space-y-2">
              <Label>Colaborador Origem *</Label>
              <Popover open={colaboradorOrigemOpen} onOpenChange={setColaboradorOrigemOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={colaboradorOrigemOpen}
                    className="w-full justify-between"
                  >
                    {colaboradorOrigem 
                      ? colaboradorOrigem.nome
                      : "Selecionar colaborador..."
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar colaborador..." />
                    <CommandList>
                      <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                      <CommandGroup>
                        {collaborators.map((collaborator) => (
                          <CommandItem
                            key={collaborator.id}
                            value={`${collaborator.nome} ${collaborator.email}`}
                            onSelect={() => {
                              setFormData(prev => ({
                                ...prev,
                                colaborador_origem_id: collaborator.id
                              }))
                              setColaboradorOrigemOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.colaborador_origem_id === collaborator.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div>
                              <div className="font-medium">{collaborator.nome}</div>
                              <div className="text-sm text-muted-foreground">{collaborator.email}</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Colaborador Destino */}
            <div className="space-y-2">
              <Label>Colaborador Destino *</Label>
              <Popover open={colaboradorDestinoOpen} onOpenChange={setColaboradorDestinoOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={colaboradorDestinoOpen}
                    className="w-full justify-between"
                  >
                    {colaboradorDestino 
                      ? colaboradorDestino.nome
                      : "Selecionar colaborador..."
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar colaborador..." />
                    <CommandList>
                      <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                      <CommandGroup>
                        {collaborators
                          .filter(c => c.id !== formData.colaborador_origem_id)
                          .map((collaborator) => (
                          <CommandItem
                            key={collaborator.id}
                            value={`${collaborator.nome} ${collaborator.email}`}
                            onSelect={() => {
                              setFormData(prev => ({
                                ...prev,
                                colaborador_destino_id: collaborator.id
                              }))
                              setColaboradorDestinoOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.colaborador_destino_id === collaborator.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div>
                              <div className="font-medium">{collaborator.nome}</div>
                              <div className="text-sm text-muted-foreground">{collaborator.email}</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Tipo de Transferência */}
          <div className="space-y-3">
            <Label>Tipo de Transferência</Label>
            <RadioGroup
              value={formData.tipo_transferencia}
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                tipo_transferencia: value,
                empresa_id: value === "todas" ? "" : prev.empresa_id
              }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="todas" id="todas" />
                <Label htmlFor="todas">Todas as empresas vinculadas</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="uma" id="uma" />
                <Label htmlFor="uma">Apenas uma empresa específica</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Empresa (se tipo específico) */}
          {formData.tipo_transferencia === "uma" && (
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Popover open={empresaOpen} onOpenChange={setEmpresaOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={empresaOpen}
                    className="w-full justify-between"
                  >
                    {empresaSelecionada 
                      ? empresaSelecionada.nome_empresarial
                      : "Selecionar empresa..."
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar empresa..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={`${client.nome_empresarial} ${client.cnpj}`}
                            onSelect={() => {
                              setFormData(prev => ({
                                ...prev,
                                empresa_id: client.id
                              }))
                              setEmpresaOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.empresa_id === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div>
                              <div className="font-medium">{client.nome_empresarial}</div>
                              <div className="text-sm text-muted-foreground">{client.cnpj}</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Data de Início */}
          <div className="space-y-2">
            <Label>Data de Início dos Novos Vínculos *</Label>
            <div className="relative">
              <Input
                placeholder="dd/mm/aaaa"
                value={formData.data_inicio ? format(formData.data_inicio, "dd/MM/yyyy", { locale: ptBR }) : ""}
                onChange={(e) => {
                  const value = e.target.value
                  // Remove caracteres não numéricos exceto /
                  const cleaned = value.replace(/[^\d/]/g, '')
                  
                  // Adiciona barras automaticamente
                  let formatted = cleaned
                  if (cleaned.length >= 3 && cleaned.length <= 5 && !cleaned.includes('/')) {
                    formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2)
                  }
                  if (cleaned.length >= 6 && cleaned.split('/').length === 2) {
                    const parts = cleaned.split('/')
                    formatted = parts[0] + '/' + parts[1].slice(0, 2) + '/' + parts[1].slice(2)
                  }
                  
                  // Limita o comprimento
                  if (formatted.length <= 10) {
                    // Tenta fazer o parse da data
                    if (formatted.length === 10) {
                      const [day, month, year] = formatted.split('/')
                      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                      if (!isNaN(date.getTime()) && 
                          date.getFullYear().toString() === year &&
                          (date.getMonth() + 1).toString().padStart(2, '0') === month &&
                          date.getDate().toString().padStart(2, '0') === day) {
                        setFormData(prev => ({ ...prev, data_inicio: date }))
                      }
                    }
                    e.target.value = formatted
                  }
                }}
                className="pr-10"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-0 hover:bg-transparent"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.data_inicio}
                    onSelect={(date) => setFormData(prev => ({ ...prev, data_inicio: date }))}
                    initialFocus
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Transferindo...' : 'Transferir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}