-- Moments Supabase Kurulumu - 08_moment_open_count.sql
-- Bu dosya, Momentlerin en fazla 2 defa acilabilmesi icin open_count alanini ekler.
-- Supabase SQL Editor'da 07_realtime.sql dosyasindan sonra calistirilmalidir.
-- Bundan once 01-07 arasindaki dosyalar calistirilmis olmalidir.

alter table public.moments
add column if not exists open_count integer not null default 0;

update public.moments
set open_count = 1
where opened_at is not null
  and open_count = 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'moments_open_count_range'
      and conrelid = 'public.moments'::regclass
  ) then
    alter table public.moments
    add constraint moments_open_count_range
    check (open_count >= 0 and open_count <= 2);
  end if;
end $$;

create index if not exists moments_receiver_open_count_expires_idx
on public.moments(receiver_id, open_count, expires_at);

create index if not exists moments_sender_open_count_idx
on public.moments(sender_id, open_count, created_at desc);
