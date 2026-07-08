-- Moments Supabase Kurulumu - 06_storage.sql
-- 05_rls_policies.sql sonrasinda calistirilir. Storage bucket ve policy kurar.

insert into storage.buckets (id, name, public)
values ('moments', 'moments', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "moments storage authenticated read" on storage.objects;
create policy "moments storage authenticated read" on storage.objects for select
using (bucket_id = 'moments' and auth.role() = 'authenticated');

drop policy if exists "moments storage own upload" on storage.objects;
create policy "moments storage own upload" on storage.objects for insert
with check (bucket_id = 'moments' and auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "moments storage own update" on storage.objects;
create policy "moments storage own update" on storage.objects for update
using (bucket_id = 'moments' and auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'moments' and auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "moments storage own delete" on storage.objects;
create policy "moments storage own delete" on storage.objects for delete
using (bucket_id = 'moments' and auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text);
