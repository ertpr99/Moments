-- Moments Supabase Kurulumu - 03_indexes.sql
-- 02_tables.sql sonrasinda calistirilir. Performans indexlerini olusturur.

create index if not exists profiles_total_score_idx on public.profiles(total_score desc);
create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists profiles_name_idx on public.profiles(name);
create index if not exists profiles_surname_idx on public.profiles(surname);
create index if not exists friend_requests_receiver_status_idx on public.friend_requests(receiver_id, status);
create index if not exists friend_requests_sender_status_idx on public.friend_requests(sender_id, status);
create index if not exists friendships_user_id_idx on public.friendships(user_id);
create index if not exists friendships_friend_id_idx on public.friendships(friend_id);
create index if not exists chats_member_a_idx on public.chats(member_a);
create index if not exists chats_member_b_idx on public.chats(member_b);
create index if not exists chats_updated_at_idx on public.chats(updated_at desc);
create index if not exists messages_chat_created_idx on public.messages(chat_id, created_at);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists moments_receiver_open_expires_idx on public.moments(receiver_id, opened_at, expires_at);
create index if not exists moments_sender_receiver_idx on public.moments(sender_id, receiver_id);
create index if not exists notifications_user_read_idx on public.notifications(user_id, read_at, created_at desc);
