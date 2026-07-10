create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  surname text not null,
  username text not null unique,
  email text not null,
  profile_photo_url text,
  friend_count integer not null default 0,
  total_moments_sent integer not null default 0,
  total_moments_opened integer not null default 0,
  total_score integer generated always as (total_moments_sent + total_moments_opened) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sender_id, receiver_id)
);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  member_a uuid not null references public.profiles(id) on delete cascade,
  member_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_a, member_b),
  check (member_a < member_b)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  deleted_for_everyone boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.message_deletions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(message_id, user_id)
);

create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  opened_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create table if not exists public.moment_views (
  moment_id uuid primary key references public.moments(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profiles_total_score_idx on public.profiles(total_score desc);
create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists friend_requests_receiver_status_idx on public.friend_requests(receiver_id, status);
create index if not exists friend_requests_sender_status_idx on public.friend_requests(sender_id, status);
create index if not exists friendships_user_id_idx on public.friendships(user_id);
create index if not exists friendships_friend_id_idx on public.friendships(friend_id);
create index if not exists chats_member_a_idx on public.chats(member_a);
create index if not exists chats_member_b_idx on public.chats(member_b);
create index if not exists messages_chat_created_idx on public.messages(chat_id, created_at);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists moments_receiver_open_expires_idx on public.moments(receiver_id, opened_at, expires_at);
create index if not exists moments_sender_receiver_idx on public.moments(sender_id, receiver_id);
create index if not exists notifications_user_read_idx on public.notifications(user_id, read_at, created_at desc);

create or replace function public.refresh_friend_count()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles
  set friend_count = (select count(*) from public.friendships where user_id = coalesce(new.user_id, old.user_id))
  where id = coalesce(new.user_id, old.user_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists friendships_friend_count_insert on public.friendships;
create trigger friendships_friend_count_insert
after insert or delete on public.friendships
for each row execute function public.refresh_friend_count();

create or replace function public.increment_moment_sent()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles set total_moments_sent = total_moments_sent + 1 where id = new.sender_id;
  return new;
end;
$$;

drop trigger if exists moments_increment_sent on public.moments;
create trigger moments_increment_sent
after insert on public.moments
for each row execute function public.increment_moment_sent();

create or replace function public.increment_moment_opened()
returns trigger language plpgsql security definer as $$
begin
  if old.opened_at is null and new.opened_at is not null then
    update public.profiles set total_moments_opened = total_moments_opened + 1 where id = new.receiver_id;
  end if;
  return new;
end;
$$;

drop trigger if exists moments_increment_opened on public.moments;
create trigger moments_increment_opened
after update of opened_at on public.moments
for each row execute function public.increment_moment_opened();

alter publication supabase_realtime add table public.friend_requests;
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.moments;
alter publication supabase_realtime add table public.notifications;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.message_deletions enable row level security;
alter table public.moments enable row level security;
alter table public.moment_views enable row level security;
alter table public.notifications enable row level security;

create policy "profiles readable" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id);

create policy "friend requests visible to members" on public.friend_requests for select using (auth.uid() in (sender_id, receiver_id));
create policy "friend requests sender insert" on public.friend_requests for insert with check (auth.uid() = sender_id);
create policy "friend requests receiver update" on public.friend_requests for update using (auth.uid() = receiver_id);

create policy "friendships visible to owner" on public.friendships for select using (auth.uid() = user_id);
create policy "friendships inserted by members" on public.friendships for insert with check (auth.uid() in (user_id, friend_id));

create policy "chats visible to members" on public.chats for select using (auth.uid() in (member_a, member_b));
create policy "chats inserted by members" on public.chats for insert with check (auth.uid() in (member_a, member_b));
create policy "chats updated by members" on public.chats for update using (auth.uid() in (member_a, member_b));

create policy "messages visible to chat members" on public.messages for select using (
  exists (select 1 from public.chats where chats.id = messages.chat_id and auth.uid() in (member_a, member_b))
);
create policy "messages inserted by chat members" on public.messages for insert with check (
  auth.uid() = sender_id and exists (select 1 from public.chats where chats.id = messages.chat_id and auth.uid() in (member_a, member_b))
);
create policy "messages updated by sender" on public.messages for update using (auth.uid() = sender_id);

create policy "message deletions own" on public.message_deletions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "moments visible to sender receiver" on public.moments for select using (auth.uid() in (sender_id, receiver_id));
create policy "moments inserted by sender" on public.moments for insert with check (auth.uid() = sender_id);
create policy "moments receiver update" on public.moments for update using (auth.uid() = receiver_id);

create policy "moment views visible to viewer" on public.moment_views for select using (auth.uid() = viewer_id);
create policy "moment views inserted by viewer" on public.moment_views for insert with check (auth.uid() = viewer_id);
create policy "moment views updated by viewer" on public.moment_views for update using (auth.uid() = viewer_id);

create policy "notifications visible own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications update own" on public.notifications for update using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('moments', 'moments', false)
on conflict (id) do nothing;

create policy "moments storage authenticated read"
on storage.objects for select
using (bucket_id = 'moments' and auth.role() = 'authenticated');

create policy "moments storage own upload"
on storage.objects for insert
with check (
  bucket_id = 'moments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "moments storage own update"
on storage.objects for update
using (
  bucket_id = 'moments'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
