-- Secure balancetes, office, and contas_balancete tables for authenticated users only

-- balancetes
ALTER TABLE public.balancetes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on balancetes" ON public.balancetes;

CREATE POLICY "Authenticated users can view balancetes"
ON public.balancetes
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert balancetes"
ON public.balancetes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update balancetes"
ON public.balancetes
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete balancetes"
ON public.balancetes
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- office
ALTER TABLE public.office ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on office" ON public.office;

CREATE POLICY "Authenticated users can view office"
ON public.office
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert office"
ON public.office
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update office"
ON public.office
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete office"
ON public.office
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- contas_balancete
ALTER TABLE public.contas_balancete ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on contas_balancete" ON public.contas_balancete;

CREATE POLICY "Authenticated users can view contas_balancete"
ON public.contas_balancete
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contas_balancete"
ON public.contas_balancete
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contas_balancete"
ON public.contas_balancete
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete contas_balancete"
ON public.contas_balancete
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);
