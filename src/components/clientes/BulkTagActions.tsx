import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Tag } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface Cliente {
  id: string
  nome_empresarial: string
  cnpj: string
}

interface ClientTag {
  id: string
  titulo: string
  cor: string
}

interface BulkTagActionsProps {
  clients: Cliente[]
  availableTags: ClientTag[]
  onComplete: () => void
}

export function BulkTagActions({ clients, availableTags, onComplete }: BulkTagActionsProps) {
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [selectedTag, setSelectedTag] = useState<string>("")
  const [action, setAction] = useState<'add' | 'remove'>('add')
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const { toast } = useToast()

  const handleClientToggle = (clientId: string) => {
    const newSelected = new Set(selectedClients)
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId)
    } else {
      newSelected.add(clientId)
    }
    setSelectedClients(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)))
    }
  }

  const handleBulkAction = async () => {
    if (selectedClients.size === 0 || !selectedTag) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um cliente e uma etiqueta",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const clientIds = Array.from(selectedClients)
      
      if (action === 'add') {
        // Adicionar etiqueta aos clientes
        const assignments = clientIds.map(clientId => ({
          client_id: clientId,
          tag_id: selectedTag
        }))
        
        const { error } = await supabase
          .from('client_tag_assignments')
          .upsert(assignments, { 
            onConflict: 'client_id,tag_id',
            ignoreDuplicates: true 
          })
        
        if (error) throw error
        
        toast({
          title: "Sucesso",
          description: `Etiqueta adicionada a ${clientIds.length} cliente(s)`
        })
      } else {
        // Remover etiqueta dos clientes
        const { error } = await supabase
          .from('client_tag_assignments')
          .delete()
          .in('client_id', clientIds)
          .eq('tag_id', selectedTag)
        
        if (error) throw error
        
        toast({
          title: "Sucesso", 
          description: `Etiqueta removida de ${clientIds.length} cliente(s)`
        })
      }

      // Reset form
      setSelectedClients(new Set())
      setSelectedTag("")
      setIsOpen(false)
      onComplete()
      
    } catch (error: any) {
      console.error('Erro na ação em massa:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao executar ação em massa",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const currentTag = availableTags.find(tag => tag.id === selectedTag)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        disabled={clients.length === 0}
        className="flex items-center gap-2"
      >
        <Tag className="h-4 w-4" />
        Ações em Massa
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ações em Massa - Etiquetas
            </DialogTitle>
            <DialogDescription>
              Adicione ou remova etiquetas de vários clientes de uma vez
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium">Ação</label>
                <Select value={action} onValueChange={(value: 'add' | 'remove') => setAction(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Adicionar etiqueta</SelectItem>
                    <SelectItem value="remove">Remover etiqueta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium">Etiqueta</label>
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma etiqueta" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            style={{ borderColor: tag.cor, color: tag.cor }}
                          >
                            {tag.titulo}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Clientes ({selectedClients.size} de {clients.length} selecionados)
                </label>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedClients.size === clients.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
              </div>

              <div className="border rounded-lg max-h-60 overflow-y-auto">
                {clients.map((client) => (
                  <div 
                    key={client.id}
                    className="flex items-center p-3 border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedClients.has(client.id)}
                      onCheckedChange={() => handleClientToggle(client.id)}
                    />
                    <div className="ml-3 flex-1">
                      <p className="font-medium text-sm">{client.nome_empresarial}</p>
                      <p className="text-xs text-muted-foreground">{client.cnpj}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleBulkAction}
              disabled={selectedClients.size === 0 || !selectedTag || loading}
              className="bg-gradient-primary hover:opacity-90"
            >
              {loading ? 'Processando...' : `${action === 'add' ? 'Adicionar' : 'Remover'} Etiqueta`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}