-- Moments Supabase Kurulumu - 04_functions_triggers.sql
--
-- Bu dosya ne yapar?
-- Arkadas sayisi, Moment atma/acma sayilari ve chat updated_at alanlarini otomatik guncelleyen function ve trigger'lari kurar.
--
-- Ne zaman calistirilir?
-- 03_indexes.sql basariyla calistiktan sonra Supabase SQL Editor'da calistirilir.
--
-- Bundan once hangi dosya calismis olmali?
-- 01_extensions.sql
-- 02_tables.sql
-- 03_indexes.sql

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists friend_requests_set_updated_at on public.friend_requests;
create trigger friend_requests_set_updated_at
before update on public.friend_requests
for each row execute function public.set_updated_at();

drop trigger if exists chats_set_updated_at on public.chats;
create trigger chats_set_updated_at
before update on public.chats
for each row execute function public.set_updated_at();

create or replace function public.refresh_friend_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  target_user_id := coalesce(new.user_id, old.user_id);

  update public.profiles
  set friend_count = (
    select count(*)
    from public.friendships
    where user_id = target_user_id
  )
  where id = target_user_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists friendships_refresh_friend_count on public.friendships;
create trigger friendships_refresh_friend_count
after insert or delete on public.friendships
for each row execute function public.refresh_friend_count();

create or replace function public.increment_moment_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set total_moments_sent = total_moments_sent + 1
  where id = new.sender_id;

  return new;
end;
$$;

drop trigger if exists moments_increment_sent on public.moments;
create trigger moments_increment_sent
after insert on public.moments
for each row execute function public.increment_moment_sent();

create or replace function public.increment_moment_opened()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.opened_at is null and new.opened_at is not null then
    update public.profiles
    set total_moments_opened = total_moments_opened + 1
    where id = new.receiver_id;
  end if;

  return new;
end;
$$;

drop trigger if exists moments_increment_opened on public.moments;
create trigger moments_increment_opened
after update of opened_at on public.moments
for each row execute function public.increment_moment_opened();

create or replace function public.touch_chat_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats
  set updated_at = now()
  where id = new.chat_id;

  return new;
end;
$$;

drop trigger if exists messages_touch_chat on public.messages;
create trigger messages_touch_chat
after insert on public.messages
for each row execute function public.touch_chat_after_message();
