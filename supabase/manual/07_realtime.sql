-- Moments Supabase Kurulumu - 07_realtime.sql
--
-- Bu dosya ne yapar?
-- Realtime icin gerekli tablolari supabase_realtime publication'ina ekler.
--
-- Ne zaman calistirilir?
-- 06_storage.sql basariyla calistiktan sonra Supabase SQL Editor'da son dosya olarak calistirilir.
--
-- Bundan once hangi dosya calismis olmali?
-- 01_extensions.sql
-- 02_tables.sql
-- 03_indexes.sql
-- 04_functions_triggers.sql
-- 05_rls_policies.sql
-- 06_storage.sql

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'friend_requests'
  ) then
    alter publication supabase_realtime add table public.friend_requests;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'moments'
  ) then
    alter publication supabase_realtime add table public.moments;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
