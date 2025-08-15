-- Remover políticas existentes para orgaos_instituicoes
DROP POLICY IF EXISTS "Authenticated users can manage orgaos_instituicoes" ON public.orgaos_instituicoes;

-- Criar políticas mais simples que permitam operadores completos
CREATE POLICY "operadores_e_admins_podem_gerenciar_orgaos" 
ON public.orgaos_instituicoes 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('administrador', 'operador')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('administrador', 'operador')
  )
);