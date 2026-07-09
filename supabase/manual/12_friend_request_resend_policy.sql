-- Moments Supabase Kurulumu - 12_friend_request_resend_policy.sql
-- Ayni kisiye daha once olusmus/reddedilmis arkadas istegini yeniden pending yapabilmek icin RLS update policy ekler.
-- 01-11 dosyalari calistirildiktan sonra bir kez calistirilabilir.
-- Tekrar calistirilmasi guvenlidir.

drop policy if exists "friend requests sender resend" on public.friend_requests;

create policy "friend requests sender resend"
on public.friend_requests
for update
using (
  auth.uid() = sender_id
  and status in ('pending', 'rejected')
)
with check (
  auth.uid() = sender_id
  and status = 'pending'
);
