-- Add optional fields to processos table
ALTER TABLE public.processos 
ADD COLUMN orgao_id uuid REFERENCES public.orgaos_instituicoes(id),
ADD COLUMN processo_numero text;