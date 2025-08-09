-- Ensure table, policies, trigger, and backfill aggregated values for parametrizacoes_valores
BEGIN;

-- 1) Create table if not exists
CREATE TABLE IF NOT EXISTS public.parametrizacoes_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  plano_padrao_conta_id uuid NOT NULL,
  competencia text NOT NULL,
  saldo_atual numeric NOT NULL DEFAULT 0,
  saldo_anterior numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parametrizacoes_valores_unique UNIQUE (empresa_id, competencia, plano_padrao_conta_id),
  CONSTRAINT parametrizacoes_valores_empresa_fk FOREIGN KEY (empresa_id) REFERENCES public.clients (id) ON DELETE CASCADE,
  CONSTRAINT parametrizacoes_valores_plano_fk FOREIGN KEY (plano_padrao_conta_id) REFERENCES public.plano_contas (id) ON DELETE CASCADE
);

-- 2) Enable RLS (idempotent)
ALTER TABLE public.parametrizacoes_valores ENABLE ROW LEVEL SECURITY;

-- 3) Create permissive policy if not exists (to match existing tables style)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='parametrizacoes_valores' AND policyname='Allow all operations on parametrizacoes_valores'
  ) THEN
    CREATE POLICY "Allow all operations on parametrizacoes_valores"
      ON public.parametrizacoes_valores
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END$$;

-- 4) Ensure updated_at trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_parametrizacoes_valores_updated_at'
  ) THEN
    CREATE TRIGGER update_parametrizacoes_valores_updated_at
    BEFORE UPDATE ON public.parametrizacoes_valores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 5) Backfill aggregated values from existing balancetes parametrizados/parametrizando
WITH dados AS (
  SELECT
    c.id AS empresa_id,
    p.plano_conta_id AS plano_padrao_conta_id,
    to_char(make_date(b.ano, b.mes, 1), 'YYYY-MM') AS competencia,
    SUM(cb.saldo_atual)::numeric AS saldo_atual,
    SUM(cb.saldo_anterior)::numeric AS saldo_anterior
  FROM public.balancetes b
  JOIN public.clients c ON c.cnpj = b.cnpj
  JOIN public.contas_balancete cb ON cb.balancete_id = b.id
  JOIN public.parametrizacoes p 
    ON p.empresa_cnpj = b.cnpj
   AND p.conta_balancete_codigo = cb.codigo
  WHERE b.status IN ('parametrizado','parametrizando')
  GROUP BY c.id, p.plano_conta_id, to_char(make_date(b.ano, b.mes, 1), 'YYYY-MM')
)
INSERT INTO public.parametrizacoes_valores (
  empresa_id, plano_padrao_conta_id, competencia, saldo_atual, saldo_anterior
)
SELECT empresa_id, plano_padrao_conta_id, competencia, saldo_atual, saldo_anterior
FROM dados
ON CONFLICT (empresa_id, competencia, plano_padrao_conta_id) DO UPDATE
SET saldo_atual = EXCLUDED.saldo_atual,
    saldo_anterior = EXCLUDED.saldo_anterior,
    updated_at = now();

COMMIT;