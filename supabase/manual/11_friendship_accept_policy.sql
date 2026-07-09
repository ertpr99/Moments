-- Moments Supabase Kurulumu - 11_friendship_accept_policy.sql
-- Arkadas istegi kabul edilince iki yonlu friendship satirlarinin RLS tarafinda eklenebilmesini saglar.
-- 01-10 dosyalari calistirildiktan sonra bir kez calistirilabilir.
-- Tekrar calistirilmasi guvenlidir.

drop policy if exists "friendships inserted after accepted request" on public.friendships;

create policy "friendships inserted after accepted request"
on public.friendships
for insert
with check (
  exists (
    select 1
    from public.friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.sender_id = friendships.user_id and fr.receiver_id = friendships.friend_id)
        or
        (fr.sender_id = friendships.friend_id and fr.receiver_id = friendships.user_id)
      )
      and auth.uid() in (fr.sender_id, fr.receiver_id)
  )
);
