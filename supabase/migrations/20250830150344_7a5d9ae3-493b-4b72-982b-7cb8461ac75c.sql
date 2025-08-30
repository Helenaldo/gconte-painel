-- Corrigir a função update_balancete_progress para usar total do plano padrão
CREATE OR REPLACE FUNCTION public.update_balancete_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_plano_padrao INTEGER := 62; -- Total de contas do plano padrão
BEGIN
  -- Contar contas únicas do plano padrão parametrizadas
  UPDATE public.balancetes 
  SET contas_parametrizadas = (
    SELECT COUNT(DISTINCT p.plano_conta_id)
    FROM public.parametrizacoes p
    WHERE p.empresa_cnpj = NEW.empresa_cnpj
  ),
  status = CASE 
    WHEN (
      SELECT COUNT(DISTINCT p.plano_conta_id)
      FROM public.parametrizacoes p
      WHERE p.empresa_cnpj = NEW.empresa_cnpj
    ) = total_plano_padrao THEN 'parametrizado'
    WHEN (
      SELECT COUNT(DISTINCT p.plano_conta_id)
      FROM public.parametrizacoes p
      WHERE p.empresa_cnpj = NEW.empresa_cnpj
    ) > 0 THEN 'parametrizando'
    ELSE 'pendente'
  END
  WHERE cnpj = NEW.empresa_cnpj;
  
  RETURN NEW;
END;
$function$;

-- Atualizar todos os balancetes existentes com a lógica correta
UPDATE public.balancetes 
SET contas_parametrizadas = (
  SELECT COUNT(DISTINCT p.plano_conta_id)
  FROM public.parametrizacoes p
  WHERE p.empresa_cnpj = balancetes.cnpj
),
status = CASE 
  WHEN (
    SELECT COUNT(DISTINCT p.plano_conta_id)
    FROM public.parametrizacoes p
    WHERE p.empresa_cnpj = balancetes.cnpj
  ) = 62 THEN 'parametrizado'
  WHEN (
    SELECT COUNT(DISTINCT p.plano_conta_id)
    FROM public.parametrizacoes p
    WHERE p.empresa_cnpj = balancetes.cnpj
  ) > 0 THEN 'parametrizando'
  ELSE 'pendente'
END;