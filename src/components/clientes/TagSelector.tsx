import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, Plus, X, Tag } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"

interface ClientTag {
  id: string
  titulo: string
  cor: string
  descricao: string | null
}

interface TagSelectorProps {
  clientId?: string
  selectedTags: ClientTag[]
  onTagsChange: (tags: ClientTag[]) => void
  placeholder?: string
  className?: string
}

export function TagSelector({ 
  clientId, 
  selectedTags, 
  onTagsChange, 
  placeholder = "Selecionar etiquetas...",
  className 
}: TagSelectorProps) {
  const [open, setOpen] = useState(false)
  const [availableTags, setAvailableTags] = useState<ClientTag[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  const loadAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('client_tags')
        .select('*')
        .order('titulo')
      
      if (error) throw error
      setAvailableTags(data || [])
    } catch (error) {
      console.error('Erro ao carregar etiquetas:', error)
    }
  }

  useEffect(() => {
    loadAvailableTags()
  }, [])

  const handleTagToggle = (tag: ClientTag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id)
    
    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  const removeTag = (tagId: string) => {
    onTagsChange(selectedTags.filter(t => t.id !== tagId))
  }

  const filteredTags = availableTags.filter(tag =>
    tag.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className={cn("space-y-2", className)}>
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge 
              key={tag.id} 
              variant="secondary"
              style={{ backgroundColor: tag.cor, color: '#fff' }}
              className="pr-1"
            >
              {tag.titulo}
              <button
                type="button"
                className="ml-1 hover:bg-black/20 rounded-full p-0.5"
                onClick={() => removeTag(tag.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start"
          >
            <Tag className="mr-2 h-4 w-4" />
            {selectedTags.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              `${selectedTags.length} etiqueta(s) selecionada(s)`
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput 
              placeholder="Buscar etiquetas..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              <CommandEmpty>Nenhuma etiqueta encontrada.</CommandEmpty>
              <CommandGroup>
                {filteredTags.map((tag) => {
                  const isSelected = selectedTags.some(t => t.id === tag.id)
                  return (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => handleTagToggle(tag)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Badge 
                        variant="outline"
                        style={{ borderColor: tag.cor, color: tag.cor }}
                        className="mr-2"
                      >
                        {tag.titulo}
                      </Badge>
                      {tag.descricao && (
                        <span className="text-sm text-muted-foreground">
                          {tag.descricao}
                        </span>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}