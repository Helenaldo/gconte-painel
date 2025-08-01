-- Adicionar coluna status na tabela taxation
ALTER TABLE public.taxation 
ADD COLUMN status text NOT NULL DEFAULT 'ativa';

-- Criar índice para melhor performance nas consultas por status
CREATE INDEX idx_taxation_status ON public.taxation(status);

-- Criar função para atualizar status das tributações anteriores
CREATE OR REPLACE FUNCTION update_taxation_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Inativar todas as tributações anteriores do mesmo cliente
  UPDATE public.taxation 
  SET status = 'inativa'
  WHERE client_id = NEW.client_id 
    AND data < NEW.data 
    AND status = 'ativa';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para executar a função automaticamente
CREATE TRIGGER trigger_update_taxation_status
  AFTER INSERT ON public.taxation
  FOR EACH ROW
  EXECUTE FUNCTION update_taxation_status();