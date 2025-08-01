-- Create RLS policies for balancetes
CREATE POLICY "Allow all operations on balancetes" 
ON public.balancetes 
FOR ALL 
USING (true);

-- Create RLS policies for contas_balancete  
CREATE POLICY "Allow all operations on contas_balancete"
ON public.contas_balancete
FOR ALL
USING (true);

-- Create updated_at triggers
CREATE TRIGGER update_balancetes_updated_at
  BEFORE UPDATE ON public.balancetes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contas_balancete_updated_at
  BEFORE UPDATE ON public.contas_balancete
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();