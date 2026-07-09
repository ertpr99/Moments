-- Moments Supabase Kurulumu - 10_friend_request_cancel_policy.sql
-- Arkadas istegi gonderen kullanicinin kendi pending istegini iptal edebilmesi icin RLS delete policy ekler.
-- 01-09 dosyalari calistirildiktan sonra bir kez calistirilabilir.
-- Tekrar calistirilmasi guvenlidir.

drop policy if exists "friend requests sender delete pending" on public.friend_requests;

create policy "friend requests sender delete pending"
on public.friend_requests
for delete
using (
  auth.uid() = sender_id
  and status = 'pending'
);
