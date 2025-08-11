-- Secure parametrizacoes_valores for authenticated users only
ALTER TABLE public.parametrizacoes_valores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on parametrizacoes_valores" ON public.parametrizacoes_valores;

CREATE POLICY "Authenticated users can view parametrizacoes_valores"
ON public.parametrizacoes_valores
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert parametrizacoes_valores"
ON public.parametrizacoes_valores
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update parametrizacoes_valores"
ON public.parametrizacoes_valores
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete parametrizacoes_valores"
ON public.parametrizacoes_valores
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);
