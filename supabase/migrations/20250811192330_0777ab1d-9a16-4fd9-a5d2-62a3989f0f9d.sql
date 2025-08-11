-- Secure taxation, events, plano_contas, and parametrizacoes for authenticated users only

-- taxation
ALTER TABLE public.taxation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on taxation" ON public.taxation;

CREATE POLICY "Authenticated users can view taxation"
ON public.taxation
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert taxation"
ON public.taxation
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update taxation"
ON public.taxation
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete taxation"
ON public.taxation
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on events" ON public.events;

CREATE POLICY "Authenticated users can view events"
ON public.events
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update events"
ON public.events
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete events"
ON public.events
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- plano_contas
ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on plano_contas" ON public.plano_contas;

CREATE POLICY "Authenticated users can view plano_contas"
ON public.plano_contas
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert plano_contas"
ON public.plano_contas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update plano_contas"
ON public.plano_contas
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete plano_contas"
ON public.plano_contas
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- parametrizacoes
ALTER TABLE public.parametrizacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on parametrizacoes" ON public.parametrizacoes;

CREATE POLICY "Authenticated users can view parametrizacoes"
ON public.parametrizacoes
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert parametrizacoes"
ON public.parametrizacoes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update parametrizacoes"
ON public.parametrizacoes
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete parametrizacoes"
ON public.parametrizacoes
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);
