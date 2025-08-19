-- Atualizar políticas RLS para permitir que operadores vejam/editem todos os processos
-- mas só possam excluir processos que eles criaram

-- Remover TODAS as políticas existentes primeiro
DROP POLICY IF EXISTS "processos_select" ON public.processos;
DROP POLICY IF EXISTS "processos_update" ON public.processos;
DROP POLICY IF EXISTS "processos_delete" ON public.processos;
DROP POLICY IF EXISTS "processos_insert" ON public.processos;

-- Remover políticas existentes de movimentos
DROP POLICY IF EXISTS "movimentos_select" ON public.movimentos;
DROP POLICY IF EXISTS "movimentos_update" ON public.movimentos;
DROP POLICY IF EXISTS "movimentos_delete" ON public.movimentos;
DROP POLICY IF EXISTS "movimentos_insert" ON public.movimentos;

-- Criar novas políticas para processos
-- Operadores e administradores podem ver todos os processos
CREATE POLICY "processos_select" ON public.processos
FOR SELECT
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);

-- Operadores e administradores podem editar todos os processos
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

-- Apenas administradores podem excluir qualquer processo
-- Operadores só podem excluir processos que eles criaram
CREATE POLICY "processos_delete" ON public.processos
FOR DELETE
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  (has_role(auth.uid(), 'operador'::app_role) AND responsavel_id = auth.uid())
);

-- Administradores podem inserir para qualquer pessoa
-- Operadores só podem inserir processos para si mesmos
CREATE POLICY "processos_insert" ON public.processos
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  (has_role(auth.uid(), 'operador'::app_role) AND responsavel_id = auth.uid())
);

-- Criar novas políticas para movimentos
-- Operadores e administradores podem ver todos os movimentos
CREATE POLICY "movimentos_select" ON public.movimentos
FOR SELECT
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);

-- Operadores e administradores podem editar todos os movimentos
CREATE POLICY "movimentos_update" ON public.movimentos
FOR UPDATE
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  (has_role(auth.uid(), 'operador'::app_role) AND responsavel_id = auth.uid())
);

-- Apenas administradores podem excluir qualquer movimento
-- Operadores só podem excluir movimentos que eles criaram
CREATE POLICY "movimentos_delete" ON public.movimentos
FOR DELETE
USING (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  (has_role(auth.uid(), 'operador'::app_role) AND responsavel_id = auth.uid())
);

-- Administradores podem inserir movimentos para qualquer processo
-- Operadores só podem inserir movimentos em processos onde são responsáveis
CREATE POLICY "movimentos_insert" ON public.movimentos
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'administrador'::app_role) OR 
  (has_role(auth.uid(), 'operador'::app_role) AND responsavel_id = auth.uid())
);