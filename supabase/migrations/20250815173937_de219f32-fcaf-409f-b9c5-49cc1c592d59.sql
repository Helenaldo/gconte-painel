-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage orgaos_instituicoes" ON public.orgaos_instituicoes;
DROP POLICY IF EXISTS "Operadores can view orgaos_instituicoes" ON public.orgaos_instituicoes;

-- Create new policies that allow both admins and operators to manage organizations
CREATE POLICY "Authenticated users can manage orgaos_instituicoes" 
ON public.orgaos_instituicoes 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

-- Also update the orgao_documentos_modelo table policies to match
DROP POLICY IF EXISTS "Admins can manage orgao_documentos_modelo" ON public.orgao_documentos_modelo;
DROP POLICY IF EXISTS "Operadores can view orgao_documentos_modelo" ON public.orgao_documentos_modelo;

CREATE POLICY "Authenticated users can manage orgao_documentos_modelo" 
ON public.orgao_documentos_modelo 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role) OR has_role(auth.uid(), 'operador'::app_role));