-- Moments Supabase Kurulumu - 13_friend_request_repair_policy.sql
-- Bu dosya, eski/yarim kalmis arkadaslik istegi kayitlarini kullanicinin tekrar bekleyen istege cevirebilmesini saglar.
-- Supabase SQL Editor'da 12_friend_request_resend_policy.sql dosyasindan sonra calistirilmalidir.
-- Bundan once 01-12 arasindaki dosyalar calistirilmis olmalidir.

drop policy if exists "friend requests sender repair stale" on public.friend_requests;

create policy "friend requests sender repair stale"
on public.friend_requests
for update
using (
  auth.uid() = sender_id
  and status in ('pending', 'rejected', 'accepted')
)
with check (
  auth.uid() = sender_id
  and status = 'pending'
);
