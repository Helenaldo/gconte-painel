-- Criar trigger para atualizar automaticamente o progresso dos balancetes
-- quando parametrizações são inseridas, atualizadas ou deletadas

CREATE OR REPLACE TRIGGER trigger_update_balancete_progress_insert
    AFTER INSERT ON public.parametrizacoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_balancete_progress();

CREATE OR REPLACE TRIGGER trigger_update_balancete_progress_update
    AFTER UPDATE ON public.parametrizacoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_balancete_progress();

CREATE OR REPLACE TRIGGER trigger_update_balancete_progress_delete
    AFTER DELETE ON public.parametrizacoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_balancete_progress();

-- Atualizar todos os balancetes existentes para garantir status correto
UPDATE public.balancetes 
SET contas_parametrizadas = (
  SELECT COUNT(DISTINCT p.conta_balancete_codigo)
  FROM public.parametrizacoes p
  WHERE p.empresa_cnpj = balancetes.cnpj
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
    WHERE p.empresa_cnpj = balancetes.cnpj
      AND EXISTS (
        SELECT 1 FROM public.contas_balancete cb 
        WHERE cb.balancete_id = balancetes.id 
          AND cb.codigo = p.conta_balancete_codigo
      )
  ) = total_contas THEN 'parametrizado'
  WHEN (
    SELECT COUNT(DISTINCT p.conta_balancete_codigo)
    FROM public.parametrizacoes p
    WHERE p.empresa_cnpj = balancetes.cnpj
      AND EXISTS (
        SELECT 1 FROM public.contas_balancete cb 
        WHERE cb.balancete_id = balancetes.id 
          AND cb.codigo = p.conta_balancete_codigo
      )
  ) > 0 THEN 'parametrizando'
  ELSE 'pendente'
END
WHERE TRUE;