-- Corrigir a função update_balancete_progress para contar contas únicas do plano padrão parametrizadas
CREATE OR REPLACE FUNCTION public.update_balancete_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Contar contas únicas do plano padrão parametrizadas (não total de parametrizações)
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
    ) = total_contas THEN 'parametrizado'
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

-- Atualizar todos os balancetes existentes com a contagem correta de contas do plano padrão
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
  ) = balancetes.total_contas THEN 'parametrizado'
  WHEN (
    SELECT COUNT(DISTINCT p.plano_conta_id)
    FROM public.parametrizacoes p
    WHERE p.empresa_cnpj = balancetes.cnpj
  ) > 0 THEN 'parametrizando'
  ELSE 'pendente'
END
WHERE EXISTS (
  SELECT 1 FROM public.parametrizacoes p 
  WHERE p.empresa_cnpj = balancetes.cnpj
);