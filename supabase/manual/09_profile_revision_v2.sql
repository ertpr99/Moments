-- Moments Supabase Kurulumu - 09_profile_revision_v2.sql
-- Profesyonel revizyon v2 icin profil duzenleme, hesap turu, dondurma ve silme alanlarini ekler.
-- 01-08 dosyalari calistirildiktan sonra Supabase SQL Editor'da bir kez calistirilabilir.
-- Tekrar calistirilmasi guvenlidir.

alter table public.profiles add column if not exists account_type text not null default 'personal';
alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists name_changed_at timestamptz;
alter table public.profiles add column if not exists username_changed_at timestamptz;
alter table public.profiles add column if not exists account_type_changed_at timestamptz;
alter table public.profiles add column if not exists frozen_until timestamptz;
alter table public.profiles add column if not exists freeze_requested_at timestamptz;
alter table public.profiles add column if not exists delete_requested_at timestamptz;
alter table public.profiles add column if not exists deleted_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('personal', 'business'));

create index if not exists profiles_active_lookup_idx
on public.profiles (deleted_at, frozen_until);

create index if not exists profiles_business_name_idx
on public.profiles using gin (business_name gin_trgm_ops);
