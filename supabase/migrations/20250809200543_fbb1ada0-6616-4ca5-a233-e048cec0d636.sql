-- 1) Add saldo_anterior to contas_balancete
ALTER TABLE public.contas_balancete
  ADD COLUMN IF NOT EXISTS saldo_anterior DECIMAL(18,2) NOT NULL DEFAULT 0;

-- 2) Backfill/reprocess: set saldo_anterior using previous month's saldo_atual
-- For balancetes with status parametrizando or parametrizado
WITH updated AS (
  UPDATE public.contas_balancete cb
  SET saldo_anterior = COALESCE(prev_data.saldo_atual, 0)
  FROM public.balancetes b
  LEFT JOIN LATERAL (
    SELECT cbp.saldo_atual
    FROM public.balancetes bp
    JOIN public.contas_balancete cbp ON cbp.balancete_id = bp.id
    WHERE bp.cnpj = b.cnpj
      AND cbp.codigo = cb.codigo
      AND bp.ano = EXTRACT(YEAR FROM (make_date(b.ano, b.mes, 1) - INTERVAL '1 month'))::int
      AND bp.mes = EXTRACT(MONTH FROM (make_date(b.ano, b.mes, 1) - INTERVAL '1 month'))::int
    LIMIT 1
  ) prev_data ON TRUE
  WHERE cb.balancete_id = b.id
    AND b.status IN ('parametrizado','parametrizando')
  RETURNING 1
)
SELECT count(*) FROM updated;