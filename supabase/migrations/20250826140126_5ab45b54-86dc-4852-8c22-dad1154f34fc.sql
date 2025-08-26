-- Criar tabela para armazenar indicadores calculados
CREATE TABLE public.indicadores_calculados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_cnpj text NOT NULL,
  ano integer NOT NULL,
  mes integer NOT NULL,
  categoria text NOT NULL,
  nome_indicador text NOT NULL,
  valor numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar índice único para evitar duplicatas
CREATE UNIQUE INDEX idx_indicadores_calculados_unique 
ON public.indicadores_calculados (empresa_cnpj, ano, mes, nome_indicador);

-- Criar índices para performance
CREATE INDEX idx_indicadores_calculados_empresa_ano 
ON public.indicadores_calculados (empresa_cnpj, ano);

CREATE INDEX idx_indicadores_calculados_categoria 
ON public.indicadores_calculados (categoria);

-- Habilitar RLS
ALTER TABLE public.indicadores_calculados ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para usuários autenticados
CREATE POLICY "Authenticated users can view indicadores_calculados" 
ON public.indicadores_calculados 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert indicadores_calculados" 
ON public.indicadores_calculados 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update indicadores_calculados" 
ON public.indicadores_calculados 
FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete indicadores_calculados" 
ON public.indicadores_calculados 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_indicadores_calculados_updated_at
BEFORE UPDATE ON public.indicadores_calculados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();