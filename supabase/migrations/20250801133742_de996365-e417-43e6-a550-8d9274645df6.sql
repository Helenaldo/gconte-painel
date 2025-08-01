-- Corrigir função para incluir search_path seguro
CREATE OR REPLACE FUNCTION public.update_taxation_status()
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
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public';