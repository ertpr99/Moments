-- Moments Supabase Kurulumu - 06_storage.sql
--
-- Bu dosya ne yapar?
-- Moments icin private storage bucket olusturur ve authenticated kullanicilar icin storage policy'lerini kurar.
--
-- Ne zaman calistirilir?
-- 05_rls_policies.sql basariyla calistiktan sonra Supabase SQL Editor'da calistirilir.
--
-- Bundan once hangi dosya calismis olmali?
-- 01_extensions.sql
-- 02_tables.sql
-- 03_indexes.sql
-- 04_functions_triggers.sql
-- 05_rls_policies.sql

insert into storage.buckets (id, name, public)
values ('moments', 'moments', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "moments storage authenticated read" on storage.objects;
create policy "moments storage authenticated read"
on storage.objects for select
using (
  bucket_id = 'moments'
  and auth.role() = 'authenticated'
);

drop policy if exists "moments storage own upload" on storage.objects;
create policy "moments storage own upload"
on storage.objects for insert
with check (
  bucket_id = 'moments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "moments storage own update" on storage.objects;
create policy "moments storage own update"
on storage.objects for update
using (
  bucket_id = 'moments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'moments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "moments storage own delete" on storage.objects;
create policy "moments storage own delete"
on storage.objects for delete
using (
  bucket_id = 'moments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
