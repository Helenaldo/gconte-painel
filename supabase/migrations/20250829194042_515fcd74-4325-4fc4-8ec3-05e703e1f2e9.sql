-- Corrigir a função update_balancete_progress para contar todas as parametrizações da empresa
CREATE OR REPLACE FUNCTION public.update_balancete_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Contar todas as parametrizações únicas da empresa (não apenas do balancete específico)
  UPDATE public.balancetes 
  SET contas_parametrizadas = (
    SELECT COUNT(*)
    FROM public.parametrizacoes p
    WHERE p.empresa_cnpj = NEW.empresa_cnpj
  ),
  status = CASE 
    WHEN (
      SELECT COUNT(*)
      FROM public.parametrizacoes p
      WHERE p.empresa_cnpj = NEW.empresa_cnpj
    ) = total_contas THEN 'parametrizado'
    WHEN (
      SELECT COUNT(*)
      FROM public.parametrizacoes p
      WHERE p.empresa_cnpj = NEW.empresa_cnpj
    ) > 0 THEN 'parametrizando'
    ELSE 'pendente'
  END
  WHERE cnpj = NEW.empresa_cnpj;
  
  RETURN NEW;
END;
$function$;

-- Atualizar todos os balancetes existentes com a contagem correta
UPDATE public.balancetes 
SET contas_parametrizadas = (
  SELECT COUNT(*)
  FROM public.parametrizacoes p
  WHERE p.empresa_cnpj = balancetes.cnpj
),
status = CASE 
  WHEN (
    SELECT COUNT(*)
    FROM public.parametrizacoes p
    WHERE p.empresa_cnpj = balancetes.cnpj
  ) = balancetes.total_contas THEN 'parametrizado'
  WHEN (
    SELECT COUNT(*)
    FROM public.parametrizacoes p
    WHERE p.empresa_cnpj = balancetes.cnpj
  ) > 0 THEN 'parametrizando'
  ELSE 'pendente'
END
WHERE EXISTS (
  SELECT 1 FROM public.parametrizacoes p 
  WHERE p.empresa_cnpj = balancetes.cnpj
);