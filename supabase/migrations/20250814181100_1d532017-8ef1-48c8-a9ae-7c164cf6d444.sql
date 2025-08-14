-- Criar tabela de órgãos/instituições
CREATE TABLE public.orgaos_instituicoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  telefone TEXT,
  email TEXT,
  link_dinamico TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT nome_length CHECK (char_length(nome) >= 2 AND char_length(nome) <= 120),
  CONSTRAINT valid_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_url CHECK (link_dinamico IS NULL OR link_dinamico ~* '^https?://.+')
);

-- Criar tabela para documentos modelo
CREATE TABLE public.orgao_documentos_modelo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orgao_id UUID NOT NULL REFERENCES public.orgaos_instituicoes(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho BIGINT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_mime_type CHECK (
    mime_type IN (
      'application/pdf',
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg'
    )
  ),
  CONSTRAINT valid_file_size CHECK (tamanho <= 10485760) -- 10MB
);

-- Criar bucket para documentos modelo
INSERT INTO storage.buckets (id, name, public) 
VALUES ('orgao-documentos', 'orgao-documentos', false);

-- Habilitar RLS
ALTER TABLE public.orgaos_instituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgao_documentos_modelo ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para órgãos/instituições
-- Administradores podem fazer tudo
CREATE POLICY "Admins can manage orgaos_instituicoes" 
ON public.orgaos_instituicoes 
FOR ALL 
USING (has_role(auth.uid(), 'administrador'::app_role))
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

-- Operadores podem apenas visualizar
CREATE POLICY "Operadores can view orgaos_instituicoes" 
ON public.orgaos_instituicoes 
FOR SELECT 
USING (has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'administrador'::app_role));

-- Políticas RLS para documentos modelo
CREATE POLICY "Admins can manage orgao_documentos_modelo" 
ON public.orgao_documentos_modelo 
FOR ALL 
USING (has_role(auth.uid(), 'administrador'::app_role))
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Operadores can view orgao_documentos_modelo" 
ON public.orgao_documentos_modelo 
FOR SELECT 
USING (has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'administrador'::app_role));

-- Políticas de storage para documentos modelo
CREATE POLICY "Admins can upload orgao documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'orgao-documentos' 
  AND has_role(auth.uid(), 'administrador'::app_role)
);

CREATE POLICY "Authenticated users can view orgao documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'orgao-documentos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can update/delete orgao documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'orgao-documentos' 
  AND has_role(auth.uid(), 'administrador'::app_role)
);

CREATE POLICY "Admins can delete orgao documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'orgao-documentos' 
  AND has_role(auth.uid(), 'administrador'::app_role)
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_orgaos_instituicoes_updated_at
BEFORE UPDATE ON public.orgaos_instituicoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orgao_documentos_modelo_updated_at
BEFORE UPDATE ON public.orgao_documentos_modelo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();