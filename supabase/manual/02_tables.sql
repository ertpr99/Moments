-- Moments Supabase Kurulumu - 02_tables.sql
-- 01_extensions.sql sonrasinda calistirilir. Ana tablolari olusturur.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  surname text not null,
  business_name text,
  account_type text not null default 'personal' check (account_type in ('personal', 'business')),
  username text not null unique,
  email text not null,
  profile_photo_url text,
  is_verified boolean not null default false,
  verified_type text,
  friend_count integer not null default 0,
  total_moments_sent integer not null default 0,
  total_moments_opened integer not null default 0,
  total_score integer generated always as (total_moments_sent + total_moments_opened) stored,
  name_changed_at timestamptz,
  username_changed_at timestamptz,
  account_type_changed_at timestamptz,
  frozen_until timestamptz,
  freeze_requested_at timestamptz,
  delete_requested_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists verified_type text;
alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists account_type text not null default 'personal';
alter table public.profiles add column if not exists name_changed_at timestamptz;
alter table public.profiles add column if not exists username_changed_at timestamptz;
alter table public.profiles add column if not exists account_type_changed_at timestamptz;
alter table public.profiles add column if not exists frozen_until timestamptz;
alter table public.profiles add column if not exists freeze_requested_at timestamptz;
alter table public.profiles add column if not exists delete_requested_at timestamptz;
alter table public.profiles add column if not exists deleted_at timestamptz;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sender_id, receiver_id),
  check (sender_id <> receiver_id)
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
