-- Create public storage bucket 'anexos' and policies safely
-- Create bucket if not exists
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', true)
on conflict (id) do nothing;

-- Create policies with guards
DO $$ BEGIN
  CREATE POLICY "Public read for anexos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'anexos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can insert anexos"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anexos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can update anexos"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'anexos')
  WITH CHECK (bucket_id = 'anexos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can delete anexos"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'anexos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;