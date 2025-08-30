import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Pencil, Trash2, Tag } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface ClientTag {
  id: string
  titulo: string
  cor: string
  descricao: string | null
  created_at: string
  updated_at: string
}

interface TagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const defaultColors = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#ec4899", // pink
  "#6b7280"  // gray
]

export function TagModal({ open, onOpenChange }: TagModalProps) {
  const [tags, setTags] = useState<ClientTag[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<ClientTag | null>(null)
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    titulo: "",
    cor: "#3b82f6",
    descricao: ""
  })
  
  const { toast } = useToast()

  const loadTags = async () => {
    try {
      const { data, error } = await supabase
        .from('client_tags')
        .select('*')
        .order('titulo')
      
      if (error) throw error
      setTags(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar etiquetas:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar etiquetas",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    if (open) {
      loadTags()
    }
  }, [open])

  const resetForm = () => {
    setFormData({ titulo: "", cor: "#3b82f6", descricao: "" })
    setEditingTag(null)
    setIsFormOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.titulo.trim()) {
      toast({
        title: "Erro",
        description: "Título é obrigatório",
        variant: "destructive"
      })
      return
    }

    // Verificar duplicidade (exceto se estiver editando)
    const existingTag = tags.find(t => 
      t.titulo.toLowerCase() === formData.titulo.toLowerCase() && 
      t.id !== editingTag?.id
    )
    
    if (existingTag) {
      toast({
        title: "Erro", 
        description: "Já existe uma etiqueta com este título",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const tagData = {
        titulo: formData.titulo.trim(),
        cor: formData.cor,
        descricao: formData.descricao.trim() || null
      }

      if (editingTag) {
        const { error } = await supabase
          .from('client_tags')
          .update(tagData)
          .eq('id', editingTag.id)
        
        if (error) throw error
        toast({ title: "Sucesso", description: "Etiqueta atualizada com sucesso" })
      } else {
        const { error } = await supabase
          .from('client_tags')
          .insert([tagData])
        
        if (error) throw error
        toast({ title: "Sucesso", description: "Etiqueta criada com sucesso" })
      }

      await loadTags()
      resetForm()
    } catch (error: any) {
      console.error('Erro ao salvar etiqueta:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar etiqueta",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (tag: ClientTag) => {
    setFormData({
      titulo: tag.titulo,
      cor: tag.cor,
      descricao: tag.descricao || ""
    })
    setEditingTag(tag)
    setIsFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTagId) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('client_tags')
        .delete()
        .eq('id', deleteTagId)
      
      if (error) throw error
      toast({ title: "Sucesso", description: "Etiqueta excluída com sucesso" })
      await loadTags()
    } catch (error: any) {
      console.error('Erro ao excluir etiqueta:', error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir etiqueta",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setDeleteTagId(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Gerenciar Etiquetas
            </DialogTitle>
            <DialogDescription>
              Crie e organize etiquetas para categorizar seus clientes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Etiquetas existentes</h4>
              <Button
                onClick={() => setIsFormOpen(true)}
                size="sm"
                className="bg-gradient-primary hover:opacity-90"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova Etiqueta
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma etiqueta criada</p>
                </div>
              ) : (
                tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge style={{ backgroundColor: tag.cor, color: '#fff' }}>
                        {tag.titulo}
                      </Badge>
                      {tag.descricao && (
                        <span className="text-sm text-muted-foreground">
                          {tag.descricao}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tag)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTagId(tag.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={() => !loading && resetForm()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Editar Etiqueta" : "Nova Etiqueta"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Nome da etiqueta"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.cor === color ? 'border-foreground' : 'border-muted'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, cor: color }))}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={formData.cor}
                onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                className="w-20 h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição opcional da etiqueta"
                rows={3}
                maxLength={200}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-gradient-primary hover:opacity-90">
                {loading ? "Salvando..." : (editingTag ? "Atualizar" : "Criar")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTagId} onOpenChange={() => setDeleteTagId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta etiqueta? Esta ação não pode ser desfeita e a etiqueta será removida de todos os clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              {loading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}