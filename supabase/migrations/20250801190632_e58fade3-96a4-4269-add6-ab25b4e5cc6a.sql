-- Função para atualizar progresso da parametrização
CREATE OR REPLACE FUNCTION public.update_balancete_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Contar quantas contas únicas foram parametrizadas para esta empresa
  UPDATE public.balancetes 
  SET contas_parametrizadas = (
    SELECT COUNT(DISTINCT p.conta_balancete_codigo)
    FROM public.parametrizacoes p
    WHERE p.empresa_cnpj = NEW.empresa_cnpj
      AND EXISTS (
        SELECT 1 FROM public.contas_balancete cb 
        WHERE cb.balancete_id = balancetes.id 
          AND cb.codigo = p.conta_balancete_codigo
      )
  ),
  status = CASE 
    WHEN (
      SELECT COUNT(DISTINCT p.conta_balancete_codigo)
      FROM public.parametrizacoes p
      WHERE p.empresa_cnpj = NEW.empresa_cnpj
        AND EXISTS (
          SELECT 1 FROM public.contas_balancete cb 
          WHERE cb.balancete_id = balancetes.id 
            AND cb.codigo = p.conta_balancete_codigo
        )
    ) = total_contas THEN 'parametrizado'
    WHEN (
      SELECT COUNT(DISTINCT p.conta_balancete_codigo)
      FROM public.parametrizacoes p
      WHERE p.empresa_cnpj = NEW.empresa_cnpj
        AND EXISTS (
          SELECT 1 FROM public.contas_balancete cb 
          WHERE cb.balancete_id = balancetes.id 
            AND cb.codigo = p.conta_balancete_codigo
        )
    ) > 0 THEN 'parametrizando'
    ELSE 'pendente'
  END
  WHERE cnpj = NEW.empresa_cnpj;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para atualizar progresso quando parametrizações são inseridas/atualizadas/removidas
CREATE TRIGGER update_balancete_progress_on_insert
  AFTER INSERT ON public.parametrizacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_balancete_progress();

CREATE TRIGGER update_balancete_progress_on_update
  AFTER UPDATE ON public.parametrizacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_balancete_progress();

CREATE TRIGGER update_balancete_progress_on_delete
  AFTER DELETE ON public.parametrizacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_balancete_progress();