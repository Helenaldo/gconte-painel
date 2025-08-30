-- Criar trigger para verificar parametrizações quando um novo balancete for inserido
CREATE OR REPLACE FUNCTION public.check_balancete_parametrizacoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_plano_padrao INTEGER := 62; -- Total de contas do plano padrão
  contas_parametrizadas_count INTEGER;
BEGIN
  -- Contar contas únicas do plano padrão parametrizadas para esta empresa
  SELECT COUNT(DISTINCT p.plano_conta_id) INTO contas_parametrizadas_count
  FROM public.parametrizacoes p
  WHERE p.empresa_cnpj = NEW.cnpj;
  
  -- Atualizar o balancete recém inserido com as informações corretas
  UPDATE public.balancetes 
  SET contas_parametrizadas = contas_parametrizadas_count,
      status = CASE 
        WHEN contas_parametrizadas_count = total_plano_padrao THEN 'parametrizado'
        WHEN contas_parametrizadas_count > 0 THEN 'parametrizando'
        ELSE 'pendente'
      END
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger na tabela balancetes para executar após INSERT
CREATE TRIGGER balancetes_check_parametrizacoes
  AFTER INSERT ON public.balancetes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_balancete_parametrizacoes();