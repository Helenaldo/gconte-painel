-- Create process_types table
create table if not exists public.process_types (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  prefixo text,
  setor_default text not null,
  prazo_default integer not null default 0,
  checklist_model text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.process_types enable row level security;

-- RLS: authenticated can CRUD
DO $$ BEGIN
  CREATE POLICY "Authenticated can view process_types"
  ON public.process_types
  FOR SELECT
  TO authenticated
  USING (auth.uid() is not null);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can insert process_types"
  ON public.process_types
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() is not null);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can update process_types"
  ON public.process_types
  FOR UPDATE
  TO authenticated
  USING (auth.uid() is not null)
  WITH CHECK (auth.uid() is not null);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can delete process_types"
  ON public.process_types
  FOR DELETE
  TO authenticated
  USING (auth.uid() is not null);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER process_types_updated_at
  BEFORE UPDATE ON public.process_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index for search
create index if not exists idx_process_types_nome on public.process_types using gin (to_tsvector('portuguese', coalesce(nome,'')));

-- Create process_checklist_items table
create table if not exists public.process_checklist_items (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processos(id) on delete cascade,
  position integer not null default 0,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.process_checklist_items enable row level security;

-- RLS policies
DO $$ BEGIN
  CREATE POLICY "Authenticated can view process_checklist_items"
  ON public.process_checklist_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() is not null);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can insert process_checklist_items"
  ON public.process_checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() is not null);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can update process_checklist_items"
  ON public.process_checklist_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() is not null)
  WITH CHECK (auth.uid() is not null);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can delete process_checklist_items"
  ON public.process_checklist_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() is not null);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER process_checklist_items_updated_at
  BEFORE UPDATE ON public.process_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index on process_id
create index if not exists idx_process_checklist_items_process on public.process_checklist_items(process_id);
