-- Moments Supabase Kurulumu - 08_verified_accounts.sql
-- Bu dosya doğrulanmış hesap sistemini mevcut kuruluma ekler.
-- Supabase SQL Editor'da 01-07 dosyaları daha önce başarıyla çalıştırıldıktan sonra bir kez çalıştırılabilir.
-- Tekrar çalıştırılması güvenlidir; verified alanları ve trigger yeniden oluşturulur.

alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists verified_type text;

create or replace function public.apply_profile_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'osmanertan52@gmail.com' then
    new.is_verified := true;
    new.verified_type := 'founder';
  elsif lower(new.email) = 'ert.pr99@gmail.com' then
    new.is_verified := true;
    new.verified_type := 'official';
  else
    new.is_verified := false;
    new.verified_type := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_apply_verification on public.profiles;
create trigger profiles_apply_verification
before insert or update on public.profiles
for each row execute function public.apply_profile_verification();

update public.profiles
set updated_at = updated_at
where lower(email) in ('osmanertan52@gmail.com', 'ert.pr99@gmail.com');
