-- Atualizar políticas para permitir acesso irrestrito de operadores a todos os processos

-- Remover políticas existentes
DROP POLICY IF EXISTS "processos_select" ON public.processos;
DROP POLICY IF EXISTS "processos_update" ON public.processos;
DROP POLICY IF EXISTS "processos_delete" ON public.processos;
DROP POLICY IF EXISTS "processos_insert" ON public.processos;

DROP POLICY IF EXISTS "movimentos_select" ON public.movimentos;
DROP POLICY IF EXISTS "movimentos_update" ON public.movimentos;
DROP POLICY IF EXISTS "movimentos_delete" ON public.movimentos;
DROP POLICY IF EXISTS "movimentos_insert" ON public.movimentos;

-- PROCESSOS: Operadores e administradores podem ver TODOS os processos
CREATE POLICY "processos_select" ON public.processos
FOR SELECT
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);

-- PROCESSOS: Operadores e administradores podem editar TODOS os processos
CREATE POLICY "processos_update" ON public.processos
FOR UPDATE
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);

-- PROCESSOS: Apenas administradores podem excluir qualquer processo
-- Operadores só podem excluir processos que eles criaram
CREATE POLICY "processos_delete" ON public.processos
FOR DELETE
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  (has_role(auth.uid(), 'operador'::app_role) AND responsavel_id = auth.uid())
);

-- PROCESSOS: Administradores podem inserir para qualquer pessoa
-- Operadores podem inserir processos para qualquer pessoa também
CREATE POLICY "processos_insert" ON public.processos
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);

-- MOVIMENTOS: Operadores e administradores podem ver todos os movimentos
CREATE POLICY "movimentos_select" ON public.movimentos
FOR SELECT
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);

-- MOVIMENTOS: Operadores e administradores podem editar todos os movimentos
CREATE POLICY "movimentos_update" ON public.movimentos
FOR UPDATE
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);

-- MOVIMENTOS: Apenas administradores podem excluir qualquer movimento
-- Operadores só podem excluir movimentos que eles criaram
CREATE POLICY "movimentos_delete" ON public.movimentos
FOR DELETE
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  (has_role(auth.uid(), 'operador'::app_role) AND responsavel_id = auth.uid())
);

-- MOVIMENTOS: Operadores podem inserir movimentos em qualquer processo
CREATE POLICY "movimentos_insert" ON public.movimentos
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);