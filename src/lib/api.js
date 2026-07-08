import { appEnv, supabase } from "./supabase.js";

const profileFields = "id,name,surname,username,profile_photo_url,is_verified,verified_type,total_moments_sent,total_moments_opened,friend_count";

export function fullName(profile) {
  return [profile?.name, profile?.surname].filter(Boolean).join(" ") || profile?.username || "Moments";
}

export function initials(profile) {
  const first = profile?.name?.[0] || "";
  const second = profile?.surname?.[0] || profile?.username?.[0] || "";
  return `${first}${second}`.toUpperCase() || "MO";
}

export function score(profile) {
  return (profile?.total_moments_sent || 0) + (profile?.total_moments_opened || 0);
}

export function verificationLabel(profile) {
  if (!profile?.is_verified) return "";
  if (profile.verified_type === "founder") return "Moments Kurucusu";
  if (profile.verified_type === "official") return "Resmi Moments Hesabı";
  return "Doğrulanmış Moments hesabı";
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error) throw error;
  return data.session;
}

export async function signUp(form) {
  const username = form.username.trim().replace(/^@/, "");
  const email = form.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: form.password,
    options: {
      data: {
        name: form.name.trim(),
        surname: form.surname.trim(),
        username
      }
    }
  });
  if (error) throw error;
  if (!data.session) throw new Error("Kayıt oluşturuldu. E-posta doğrulaması açıksa e-postanı onaylayıp giriş yap.");

  await upsertProfile({
    id: data.user.id,
    name: form.name.trim(),
    surname: form.surname.trim(),
    username,
    email
  });

  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function upsertProfile(profile) {
  const { error } = await supabase.from("profiles").upsert(profile);
  if (error) throw error;
}

export async function getProfile(user) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (data) return data;
  if (error && error.code !== "PGRST116") throw error;

  const metadata = user.user_metadata || {};
  const fallback = {
    id: user.id,
    name: metadata.name || "Moments",
    surname: metadata.surname || "User",
    username: metadata.username || user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "_"),
    email: user.email || "",
    profile_photo_url: null,
    is_verified: false,
    verified_type: null
  };
  await upsertProfile(fallback);
  return getProfile(user);
}

export async function uploadProfilePhoto(userId, file) {
  const ext = file.name?.split(".").pop() || "jpg";
  const path = `${userId}/profile.${ext}`;
  const { error } = await supabase.storage.from(appEnv.storageBucketName).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true
  });
  if (error) throw error;
  const { data } = supabase.storage.from(appEnv.storageBucketName).getPublicUrl(path);
  return data.publicUrl;
}

export async function updateProfilePhoto(userId, file) {
  const profilePhotoUrl = await uploadProfilePhoto(userId, file);
  const { data, error } = await supabase
    .from("profiles")
    .update({ profile_photo_url: profilePhotoUrl })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadFriends(userId) {
  const { data, error } = await supabase
    .from("friendships")
    .select(`friend:profiles!friendships_friend_id_fkey(${profileFields})`)
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((row) => row.friend).filter(Boolean);
}

export async function loadRequests(userId) {
  const { data: incoming, error: incomingError } = await supabase
    .from("friend_requests")
    .select(`id,sender_id,receiver_id,status,created_at,sender:profiles!friend_requests_sender_id_fkey(${profileFields})`)
    .eq("receiver_id", userId)
    .eq("status", "pending");
  if (incomingError) throw incomingError;

  const { data: outgoing, error: outgoingError } = await supabase
    .from("friend_requests")
    .select(`id,sender_id,receiver_id,status,created_at,receiver:profiles!friend_requests_receiver_id_fkey(${profileFields})`)
    .eq("sender_id", userId)
    .eq("status", "pending");
  if (outgoingError) throw outgoingError;

  return { incoming: incoming || [], outgoing: outgoing || [] };
}

export async function searchUsers(userId, query, friendIds = []) {
  const clean = query.trim();
  if (!clean) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(profileFields)
    .or(`username.ilike.%${clean}%,name.ilike.%${clean}%,surname.ilike.%${clean}%`)
    .neq("id", userId)
    .limit(20);
  if (error) throw error;
  const friends = new Set(friendIds);
  return (data || []).filter((person) => !friends.has(person.id));
}

export async function sendFriendRequest(senderId, receiverId) {
  const { error } = await supabase.from("friend_requests").insert({
    sender_id: senderId,
    receiver_id: receiverId,
    status: "pending"
  });
  if (error) throw error;
}

export async function respondFriendRequest(request, accepted) {
  const status = accepted ? "accepted" : "rejected";
  const { error } = await supabase.from("friend_requests").update({ status }).eq("id", request.id);
  if (error) throw error;

  if (accepted) {
    const rows = [
      { user_id: request.sender_id, friend_id: request.receiver_id },
      { user_id: request.receiver_id, friend_id: request.sender_id }
    ];
    const { error: friendshipError } = await supabase.from("friendships").upsert(rows);
    if (friendshipError) throw friendshipError;
    await ensureChat(request.sender_id, request.receiver_id);
  }
}

export async function ensureChat(userId, friendId) {
  const [memberA, memberB] = [userId, friendId].sort();
  const { data, error } = await supabase
    .from("chats")
    .upsert({ member_a: memberA, member_b: memberB }, { onConflict: "member_a,member_b" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadChats(userId) {
  const { data: chats, error } = await supabase
    .from("chats")
    .select("id,member_a,member_b,updated_at")
    .or(`member_a.eq.${userId},member_b.eq.${userId}`)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const chatIds = (chats || []).map((chat) => chat.id);
  if (!chatIds.length) return { chats: chats || [], messages: [] };

  const { data: messages, error: messageError } = await supabase
    .from("messages")
    .select("id,chat_id,sender_id,body,created_at,deleted_for_everyone")
    .in("chat_id", chatIds)
    .eq("deleted_for_everyone", false)
    .order("created_at", { ascending: true });
  if (messageError) throw messageError;

  const { data: deletions, error: deletionError } = await supabase
    .from("message_deletions")
    .select("message_id")
    .eq("user_id", userId);
  if (deletionError) throw deletionError;

  const hidden = new Set((deletions || []).map((item) => item.message_id));
  return {
    chats: chats || [],
    messages: (messages || []).filter((message) => !hidden.has(message.id))
  };
}

export async function sendMessage(userId, friendId, body) {
  if (!body.trim()) return;
  const chat = await ensureChat(userId, friendId);
  const { error } = await supabase.from("messages").insert({
    chat_id: chat.id,
    sender_id: userId,
    body: body.trim()
  });
  if (error) throw error;
}

export async function deleteMessageForEveryone(id) {
  const { error } = await supabase.from("messages").update({ deleted_for_everyone: true }).eq("id", id);
  if (error) throw error;
}

export async function deleteMessageForSelf(messageId, userId) {
  const { error } = await supabase.from("message_deletions").upsert({ message_id: messageId, user_id: userId });
  if (error) throw error;
}

export async function loadIncomingMoments(userId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("moments")
    .select(`id,sender_id,receiver_id,storage_path,created_at,expires_at,opened_at,sender:profiles!moments_sender_id_fkey(${profileFields})`)
    .eq("receiver_id", userId)
    .is("opened_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function sendMoment(userId, receiverId, blob) {
  const path = `${userId}/${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage.from(appEnv.storageBucketName).upload(path, blob, {
    contentType: "image/png",
    upsert: false
  });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("moments").insert({
    sender_id: userId,
    receiver_id: receiverId,
    storage_path: path,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  if (error) throw error;
}

export async function openMoment(moment) {
  const { data, error } = await supabase.storage.from(appEnv.storageBucketName).createSignedUrl(moment.storage_path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function markMomentOpened(momentId, userId) {
  const now = new Date().toISOString();
  const { error: viewError } = await supabase.from("moment_views").upsert({
    moment_id: momentId,
    viewer_id: userId,
    viewed_at: now
  });
  if (viewError) throw viewError;
  const { error } = await supabase.from("moments").update({ opened_at: now }).eq("id", momentId);
  if (error) throw error;
}

export async function loadDiscover() {
  const { data, error } = await supabase
    .from("profiles")
    .select(profileFields)
    .order("total_score", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}
