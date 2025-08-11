-- Create public storage bucket for anexos if not exists and policies
-- Create bucket
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', true)
on conflict (id) do nothing;

-- Policies for storage.objects on bucket 'anexos'
-- Allow public read for files in 'anexos'
create policy if not exists "Public read for anexos"
  on storage.objects for select
  using (bucket_id = 'anexos');

-- Allow authenticated users to upload to 'anexos'
create policy if not exists "Authenticated can insert anexos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos');

-- Allow owners to update/delete if needed (authenticated)
create policy if not exists "Authenticated can update anexos"
  on storage.objects for update to authenticated
  using (bucket_id = 'anexos')
  with check (bucket_id = 'anexos');

create policy if not exists "Authenticated can delete anexos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'anexos');