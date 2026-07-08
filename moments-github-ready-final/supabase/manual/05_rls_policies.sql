-- Moments Supabase Kurulumu - 05_rls_policies.sql
--
-- Bu dosya ne yapar?
-- Tum public tablolarda Row Level Security acip Moments uygulamasinin okuma/yazma kurallarini tanimlar.
--
-- Ne zaman calistirilir?
-- 04_functions_triggers.sql basariyla calistiktan sonra Supabase SQL Editor'da calistirilir.
--
-- Bundan once hangi dosya calismis olmali?
-- 01_extensions.sql
-- 02_tables.sql
-- 03_indexes.sql
-- 04_functions_triggers.sql

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.message_deletions enable row level security;
alter table public.moments enable row level security;
alter table public.moment_views enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable"
on public.profiles for select
using (auth.role() = 'authenticated');

drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "friend requests visible to members" on public.friend_requests;
create policy "friend requests visible to members"
on public.friend_requests for select
using (auth.uid() in (sender_id, receiver_id));

drop policy if exists "friend requests sender insert" on public.friend_requests;
create policy "friend requests sender insert"
on public.friend_requests for insert
with check (auth.uid() = sender_id);

drop policy if exists "friend requests receiver update" on public.friend_requests;
create policy "friend requests receiver update"
on public.friend_requests for update
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

drop policy if exists "friendships visible to owner" on public.friendships;
create policy "friendships visible to owner"
on public.friendships for select
using (auth.uid() = user_id);

drop policy if exists "friendships inserted by members" on public.friendships;
create policy "friendships inserted by members"
on public.friendships for insert
with check (auth.uid() in (user_id, friend_id));

drop policy if exists "chats visible to members" on public.chats;
create policy "chats visible to members"
on public.chats for select
using (auth.uid() in (member_a, member_b));

drop policy if exists "chats inserted by members" on public.chats;
create policy "chats inserted by members"
on public.chats for insert
with check (auth.uid() in (member_a, member_b));

drop policy if exists "chats updated by members" on public.chats;
create policy "chats updated by members"
on public.chats for update
using (auth.uid() in (member_a, member_b))
with check (auth.uid() in (member_a, member_b));

drop policy if exists "messages visible to chat members" on public.messages;
create policy "messages visible to chat members"
on public.messages for select
using (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
    and auth.uid() in (member_a, member_b)
  )
);

drop policy if exists "messages inserted by chat members" on public.messages;
create policy "messages inserted by chat members"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
    and auth.uid() in (member_a, member_b)
  )
);

drop policy if exists "messages updated by sender" on public.messages;
create policy "messages updated by sender"
on public.messages for update
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);

drop policy if exists "message deletions own" on public.message_deletions;
create policy "message deletions own"
on public.message_deletions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "moments visible to sender receiver" on public.moments;
create policy "moments visible to sender receiver"
on public.moments for select
using (auth.uid() in (sender_id, receiver_id));

drop policy if exists "moments inserted by sender" on public.moments;
create policy "moments inserted by sender"
on public.moments for insert
with check (auth.uid() = sender_id);

drop policy if exists "moments receiver update" on public.moments;
create policy "moments receiver update"
on public.moments for update
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

drop policy if exists "moment views visible to viewer" on public.moment_views;
create policy "moment views visible to viewer"
on public.moment_views for select
using (auth.uid() = viewer_id);

drop policy if exists "moment views inserted by viewer" on public.moment_views;
create policy "moment views inserted by viewer"
on public.moment_views for insert
with check (auth.uid() = viewer_id);

drop policy if exists "moment views updated by viewer" on public.moment_views;
create policy "moment views updated by viewer"
on public.moment_views for update
using (auth.uid() = viewer_id)
with check (auth.uid() = viewer_id);

drop policy if exists "notifications visible own" on public.notifications;
create policy "notifications visible own"
on public.notifications for select
using (auth.uid() = user_id);

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own"
on public.notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
