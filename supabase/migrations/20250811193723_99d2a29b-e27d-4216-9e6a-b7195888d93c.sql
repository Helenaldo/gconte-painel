-- Create enums for processos and movimentos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'process_setor') THEN
    CREATE TYPE public.process_setor AS ENUM (
      'contabil','fiscal','pessoal','societario','financeiro','outro'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'process_prioridade') THEN
    CREATE TYPE public.process_prioridade AS ENUM (
      'baixa','media','alta','critica'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'process_status') THEN
    CREATE TYPE public.process_status AS ENUM (
      'aberto','em_andamento','aguardando_terceiros','em_revisao','concluido','cancelado'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movimento_tipo') THEN
    CREATE TYPE public.movimento_tipo AS ENUM (
      'anotacao','protocolo','solicitacao','retorno_orgao','exigencia','envio_cliente','upload'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_mov') THEN
    CREATE TYPE public.status_mov AS ENUM (
      'pendente','feito','cancelado'
    );
  END IF;
END $$;

-- Create processos table
CREATE TABLE IF NOT EXISTS public.processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  cliente_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  responsavel_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  setor public.process_setor NOT NULL,
  prioridade public.process_prioridade NOT NULL DEFAULT 'media',
  status public.process_status NOT NULL DEFAULT 'aberto',
  data_abertura timestamptz NOT NULL DEFAULT now(),
  prazo date,
  data_conclusao timestamptz,
  descricao text,
  etiquetas text[] NOT NULL DEFAULT '{}',
  origem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create movimentos table
CREATE TABLE IF NOT EXISTS public.movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  tipo public.movimento_tipo NOT NULL,
  descricao text,
  responsavel_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  data_mov timestamptz NOT NULL DEFAULT now(),
  prazo_mov timestamptz,
  status_mov public.status_mov NOT NULL DEFAULT 'pendente',
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create anexos table
CREATE TABLE IF NOT EXISTS public.anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimento_id uuid NOT NULL REFERENCES public.movimentos(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  mime text NOT NULL,
  tamanho bigint NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers to update updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_processos_updated_at'
  ) THEN
    CREATE TRIGGER update_processos_updated_at
    BEFORE UPDATE ON public.processos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_movimentos_updated_at'
  ) THEN
    CREATE TRIGGER update_movimentos_updated_at
    BEFORE UPDATE ON public.movimentos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_anexos_updated_at'
  ) THEN
    CREATE TRIGGER update_anexos_updated_at
    BEFORE UPDATE ON public.anexos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_processos_status ON public.processos (status);
CREATE INDEX IF NOT EXISTS idx_processos_prazo ON public.processos (prazo);
CREATE INDEX IF NOT EXISTS idx_processos_responsavel ON public.processos (responsavel_id);

CREATE INDEX IF NOT EXISTS idx_movimentos_processo ON public.movimentos (processo_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_status ON public.movimentos (status_mov);
CREATE INDEX IF NOT EXISTS idx_movimentos_prazo ON public.movimentos (prazo_mov);
CREATE INDEX IF NOT EXISTS idx_movimentos_responsavel ON public.movimentos (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_data ON public.movimentos (data_mov);

CREATE INDEX IF NOT EXISTS idx_anexos_movimento ON public.anexos (movimento_id);

-- RLS
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;

-- processos policies
DROP POLICY IF EXISTS "processos_admin_all" ON public.processos;
DROP POLICY IF EXISTS "processos_owner_select" ON public.processos;
DROP POLICY IF EXISTS "processos_owner_insert" ON public.processos;
DROP POLICY IF EXISTS "processos_owner_update" ON public.processos;
DROP POLICY IF EXISTS "processos_owner_delete" ON public.processos;

CREATE POLICY "processos_select"
ON public.processos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR responsavel_id = auth.uid()
);

CREATE POLICY "processos_insert"
ON public.processos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'administrador')
  OR responsavel_id = auth.uid()
);

CREATE POLICY "processos_update"
ON public.processos
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR responsavel_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'administrador')
  OR responsavel_id = auth.uid()
);

CREATE POLICY "processos_delete"
ON public.processos
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR responsavel_id = auth.uid()
);

-- movimentos policies
DROP POLICY IF EXISTS "movimentos_select" ON public.movimentos;
DROP POLICY IF EXISTS "movimentos_insert" ON public.movimentos;
DROP POLICY IF EXISTS "movimentos_update" ON public.movimentos;
DROP POLICY IF EXISTS "movimentos_delete" ON public.movimentos;

CREATE POLICY "movimentos_select"
ON public.movimentos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1 FROM public.processos p
    WHERE p.id = public.movimentos.processo_id
      AND (p.responsavel_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  )
);

CREATE POLICY "movimentos_insert"
ON public.movimentos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'administrador')
  OR (
    EXISTS (
      SELECT 1 FROM public.processos p
      WHERE p.id = public.movimentos.processo_id
        AND p.responsavel_id = auth.uid()
    )
    AND public.movimentos.responsavel_id = auth.uid()
  )
);

CREATE POLICY "movimentos_update"
ON public.movimentos
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1 FROM public.processos p
    WHERE p.id = public.movimentos.processo_id
      AND p.responsavel_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'administrador')
  OR (
    EXISTS (
      SELECT 1 FROM public.processos p
      WHERE p.id = public.movimentos.processo_id
        AND p.responsavel_id = auth.uid()
    )
    AND public.movimentos.responsavel_id = auth.uid()
  )
);

CREATE POLICY "movimentos_delete"
ON public.movimentos
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1 FROM public.processos p
    WHERE p.id = public.movimentos.processo_id
      AND p.responsavel_id = auth.uid()
  )
);

-- anexos policies
DROP POLICY IF EXISTS "anexos_select" ON public.anexos;
DROP POLICY IF EXISTS "anexos_insert" ON public.anexos;
DROP POLICY IF EXISTS "anexos_update" ON public.anexos;
DROP POLICY IF EXISTS "anexos_delete" ON public.anexos;

CREATE POLICY "anexos_select"
ON public.anexos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1
    FROM public.movimentos m
    JOIN public.processos p ON p.id = m.processo_id
    WHERE m.id = public.anexos.movimento_id
      AND (p.responsavel_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  )
);

CREATE POLICY "anexos_insert"
ON public.anexos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1
    FROM public.movimentos m
    JOIN public.processos p ON p.id = m.processo_id
    WHERE m.id = public.anexos.movimento_id
      AND p.responsavel_id = auth.uid()
  )
);

CREATE POLICY "anexos_update"
ON public.anexos
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1
    FROM public.movimentos m
    JOIN public.processos p ON p.id = m.processo_id
    WHERE m.id = public.anexos.movimento_id
      AND p.responsavel_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1
    FROM public.movimentos m
    JOIN public.processos p ON p.id = m.processo_id
    WHERE m.id = public.anexos.movimento_id
      AND p.responsavel_id = auth.uid()
  )
);

CREATE POLICY "anexos_delete"
ON public.anexos
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1
    FROM public.movimentos m
    JOIN public.processos p ON p.id = m.processo_id
    WHERE m.id = public.anexos.movimento_id
      AND p.responsavel_id = auth.uid()
  )
);
