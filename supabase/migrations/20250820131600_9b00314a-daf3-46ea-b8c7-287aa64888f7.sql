-- Criar tabela para certificados digitais
CREATE TABLE public.certificados_digitais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  senha_criptografada TEXT NOT NULL,
  cnpj_certificado TEXT NOT NULL,
  emissor TEXT NOT NULL,
  numero_serie TEXT NOT NULL,
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,  
  data_vencimento TIMESTAMP WITH TIME ZONE NOT NULL,
  tamanho BIGINT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/x-pkcs12',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de auditoria para certificados
CREATE TABLE public.certificados_auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificado_id UUID NOT NULL,
  user_id UUID NOT NULL,
  acao TEXT NOT NULL, -- 'visualizar', 'download'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificados_auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can manage certificados_digitais" 
ON public.certificados_digitais 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage certificados_auditoria" 
ON public.certificados_auditoria 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Função para atualizar updated_at
CREATE TRIGGER update_certificados_digitais_updated_at
BEFORE UPDATE ON public.certificados_digitais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket para certificados se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados-digitais', 'certificados-digitais', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas para o bucket de certificados
CREATE POLICY "Authenticated users can upload certificados"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'certificados-digitais' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view certificados"
ON storage.objects
FOR SELECT
USING (bucket_id = 'certificados-digitais' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete certificados"
ON storage.objects
FOR DELETE
USING (bucket_id = 'certificados-digitais' AND auth.uid() IS NOT NULL);