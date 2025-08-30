-- Criar tabela de etiquetas (tags) para clientes
CREATE TABLE public.client_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3b82f6', -- cor hex padrão (azul)
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(titulo) -- prevenir duplicatas de título
);

-- Criar tabela de relacionamento many-to-many entre clientes e etiquetas
CREATE TABLE public.client_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.client_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, tag_id) -- prevenir duplicatas de atribuição
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para client_tags (apenas usuários autenticados)
CREATE POLICY "Authenticated users can manage client tags"
ON public.client_tags
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas RLS para client_tag_assignments (apenas usuários autenticados)
CREATE POLICY "Authenticated users can manage client tag assignments"
ON public.client_tag_assignments
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at na tabela client_tags
CREATE TRIGGER update_client_tags_updated_at
  BEFORE UPDATE ON public.client_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhorar performance
CREATE INDEX idx_client_tag_assignments_client_id ON public.client_tag_assignments(client_id);
CREATE INDEX idx_client_tag_assignments_tag_id ON public.client_tag_assignments(tag_id);