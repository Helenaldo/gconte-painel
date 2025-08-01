-- Adicionar campo status à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'));

-- Criar índice para melhor performance nas consultas por status
CREATE INDEX idx_profiles_status ON public.profiles(status);