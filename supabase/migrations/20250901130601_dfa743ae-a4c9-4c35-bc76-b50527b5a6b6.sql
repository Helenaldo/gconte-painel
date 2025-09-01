-- Criar tabela para vínculos de responsáveis
CREATE TABLE public.responsible_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  collaborator_id UUID NOT NULL,
  setores TEXT[] NOT NULL DEFAULT '{}', -- Array de setores: Contábil, Fiscal, Pessoal
  data_inicio DATE NOT NULL,
  data_fim DATE NULL,
  status TEXT NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente', 'encerrado')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NULL,
  ended_by UUID NULL,
  ended_at TIMESTAMP WITH TIME ZONE NULL
);

-- Enable Row Level Security
ALTER TABLE public.responsible_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view responsible_assignments" 
ON public.responsible_assignments 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create responsible_assignments" 
ON public.responsible_assignments 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Authenticated users can update responsible_assignments" 
ON public.responsible_assignments 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete responsible_assignments" 
ON public.responsible_assignments 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX idx_responsible_assignments_client_id ON public.responsible_assignments(client_id);
CREATE INDEX idx_responsible_assignments_collaborator_id ON public.responsible_assignments(collaborator_id);
CREATE INDEX idx_responsible_assignments_status ON public.responsible_assignments(status);
CREATE INDEX idx_responsible_assignments_data_inicio ON public.responsible_assignments(data_inicio);
CREATE INDEX idx_responsible_assignments_data_fim ON public.responsible_assignments(data_fim);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_responsible_assignments_updated_at
BEFORE UPDATE ON public.responsible_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update status based on dates
CREATE OR REPLACE FUNCTION public.update_responsible_assignment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar status baseado nas datas
  IF NEW.data_fim IS NOT NULL AND NEW.data_fim < CURRENT_DATE THEN
    NEW.status = 'encerrado';
  ELSIF NEW.data_fim IS NULL OR NEW.data_fim >= CURRENT_DATE THEN
    NEW.status = 'vigente';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-update status
CREATE TRIGGER trigger_update_responsible_assignment_status
BEFORE INSERT OR UPDATE ON public.responsible_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_responsible_assignment_status();

-- Function to prevent overlapping assignments for same client/sector
CREATE OR REPLACE FUNCTION public.validate_responsible_assignment()
RETURNS TRIGGER AS $$
DECLARE
  overlapping_count INTEGER;
  sector TEXT;
BEGIN
  -- Verificar sobreposição para cada setor
  FOREACH sector IN ARRAY NEW.setores LOOP
    SELECT COUNT(*)
    INTO overlapping_count
    FROM public.responsible_assignments ra
    WHERE ra.client_id = NEW.client_id
      AND ra.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND sector = ANY(ra.setores)
      AND ra.status = 'vigente'
      AND (
        -- Nova atribuição inicia durante período existente
        (NEW.data_inicio BETWEEN ra.data_inicio AND COALESCE(ra.data_fim, '9999-12-31'::DATE))
        OR
        -- Nova atribuição termina durante período existente
        (COALESCE(NEW.data_fim, '9999-12-31'::DATE) BETWEEN ra.data_inicio AND COALESCE(ra.data_fim, '9999-12-31'::DATE))
        OR
        -- Nova atribuição engloba período existente
        (NEW.data_inicio <= ra.data_inicio AND COALESCE(NEW.data_fim, '9999-12-31'::DATE) >= COALESCE(ra.data_fim, '9999-12-31'::DATE))
      );
      
    IF overlapping_count > 0 THEN
      RAISE EXCEPTION 'Já existe uma atribuição vigente para o setor % neste cliente no período especificado', sector;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to validate assignments
CREATE TRIGGER trigger_validate_responsible_assignment
BEFORE INSERT OR UPDATE ON public.responsible_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_responsible_assignment();