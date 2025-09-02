import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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

interface ResponsibleAssignment {
  id: string
  client_id: string
  collaborator_id: string
  setores: string[]
  data_inicio: string
  data_fim: string | null
  status: 'vigente' | 'encerrado'
}

interface ResponsavelFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment?: ResponsibleAssignment | null
  clients: Client[]
  collaborators: Collaborator[]
  onSave: () => void
}

const SETORES = ['Contábil', 'Fiscal', 'Pessoal'] as const

export function ResponsavelForm({ 
  open, 
  onOpenChange, 
  assignment, 
  clients, 
  collaborators, 
  onSave 
}: ResponsavelFormProps) {
  const [loading, setLoading] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [collaboratorOpen, setCollaboratorOpen] = useState(false)
  const [formData, setFormData] = useState({
    client_id: "",
    collaborator_id: "",
    setores: [] as string[],
    data_inicio: undefined as Date | undefined,
    data_fim: undefined as Date | undefined
  })
  
  const { profile } = useAuth()
  const { toast } = useToast()

  // Resetar formulário quando abrir/fechar ou alterar assignment
  useEffect(() => {
    if (open) {
      if (assignment) {
        setFormData({
          client_id: assignment.client_id,
          collaborator_id: assignment.collaborator_id,
          setores: [...assignment.setores],
          data_inicio: new Date(assignment.data_inicio),
          data_fim: assignment.data_fim ? new Date(assignment.data_fim) : undefined
        })
      } else {
        setFormData({
          client_id: "",
          collaborator_id: "",
          setores: [],
          data_inicio: undefined,
          data_fim: undefined
        })
      }
    }
  }, [open, assignment])

  const handleSetorChange = (setor: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      setores: checked 
        ? [...prev.setores, setor]
        : prev.setores.filter(s => s !== setor)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.client_id || !formData.collaborator_id || formData.setores.length === 0 || !formData.data_inicio) {
      toast({
        title: "Erro",
        description: "Empresa, Colaborador, pelo menos um Setor e Data de Início são obrigatórios",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const data = {
        client_id: formData.client_id,
        collaborator_id: formData.collaborator_id,
        setores: formData.setores,
        data_inicio: formData.data_inicio.toISOString().split('T')[0],
        data_fim: formData.data_fim ? formData.data_fim.toISOString().split('T')[0] : null,
        created_by: profile?.id
      }

      if (assignment) {
        const { error } = await supabase
          .from('responsible_assignments')
          .update(data)
          .eq('id', assignment.id)
        
        if (error) throw error
        
        toast({
          title: "Sucesso",
          description: "Vínculo atualizado com sucesso"
        })
      } else {
        const { error } = await supabase
          .from('responsible_assignments')
          .insert([data])
        
        if (error) throw error
        
        toast({
          title: "Sucesso", 
          description: "Vínculo criado com sucesso"
        })
      }

      onSave()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Erro ao salvar vínculo:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar vínculo",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedClient = clients.find(c => c.id === formData.client_id)
  const selectedCollaborator = collaborators.find(c => c.id === formData.collaborator_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {assignment ? 'Editar Vínculo' : 'Novo Vínculo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Empresa */}
            <div className="space-y-2">
              <Label htmlFor="client">Empresa *</Label>
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientOpen}
                    className="w-full justify-between"
                  >
                    {selectedClient 
                      ? selectedClient.nome_empresarial
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
                                client_id: client.id
                              }))
                              setClientOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.client_id === client.id ? "opacity-100" : "opacity-0"
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

            {/* Colaborador */}
            <div className="space-y-2">
              <Label htmlFor="collaborator">Colaborador *</Label>
              <Popover open={collaboratorOpen} onOpenChange={setCollaboratorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={collaboratorOpen}
                    className="w-full justify-between"
                  >
                    {selectedCollaborator 
                      ? selectedCollaborator.nome
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
                                collaborator_id: collaborator.id
                              }))
                              setCollaboratorOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.collaborator_id === collaborator.id ? "opacity-100" : "opacity-0"
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

          {/* Setores */}
          <div className="space-y-2">
            <Label>Setores *</Label>
            <div className="flex gap-4">
              {SETORES.map((setor) => (
                <div key={setor} className="flex items-center space-x-2">
                  <Checkbox
                    id={setor}
                    checked={formData.setores.includes(setor)}
                    onCheckedChange={(checked) => handleSetorChange(setor, checked as boolean)}
                  />
                  <Label htmlFor={setor}>{setor}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data Início */}
            <div className="space-y-2">
              <Label>Data de Início *</Label>
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

            {/* Data Fim */}
            <div className="space-y-2">
              <Label>Data de Término</Label>
              <div className="relative">
                <Input
                  placeholder="dd/mm/aaaa (opcional)"
                  value={formData.data_fim ? format(formData.data_fim, "dd/MM/yyyy", { locale: ptBR }) : ""}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === "") {
                      setFormData(prev => ({ ...prev, data_fim: undefined }))
                      return
                    }
                    
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
                          setFormData(prev => ({ ...prev, data_fim: date }))
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
                      selected={formData.data_fim}
                      onSelect={(date) => setFormData(prev => ({ ...prev, data_fim: date }))}
                      initialFocus
                      locale={ptBR}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : (assignment ? 'Atualizar' : 'Criar')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}