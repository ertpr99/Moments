import { appEnv, hasSupabaseConfig, supabase } from "./supabase.js";

export function displayName(profile) {
  if (!profile) return "Moments";
  return [profile.name, profile.surname].filter(Boolean).join(" ") || profile.business_name || profile.username || "Moments";
}

export function score(profile) {
  return (profile?.total_moments_sent || 0) + (profile?.total_moments_opened || 0);
}

export function initials(profile) {
  return (displayName(profile).split(" ").map((part) => part[0]).join("").slice(0, 2) || "MO").toUpperCase();
}

export function normalizeUsername(username) {
  return String(username || "").replace(/^@/, "").trim().toLowerCase();
}

export function validateUsername(username) {
  const value = normalizeUsername(username);
  if (!value) return "Kullanıcı adı gerekli.";
  if (!/^[a-z0-9_.]+$/.test(value)) return "Küçük harf, rakam, _ ve . kullanılabilir.";
  if (value.length < 3) return "En az 3 karakter olmalı.";
  return "";
}

const profileFields = "id,name,surname,business_name,username,email,profile_photo_url,friend_count,total_moments_sent,total_moments_opened,is_verified,verified_type,account_type";

function requireClient() {
  if (!hasSupabaseConfig) throw new Error("Supabase bağlantısı eksik.");
  return supabase;
}

export async function getSession() {
  if (!hasSupabaseConfig) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUp(form) {
  const username = normalizeUsername(form.username);
  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);
  const metadata = {
    name: form.name || form.businessName || "Moments",
    surname: form.accountType === "business" ? "" : form.surname,
    business_name: form.accountType === "business" ? form.businessName : null,
    username,
    account_type: form.accountType || "personal"
  };
  const { data, error } = await requireClient().auth.signUp({
    email: form.email,
    password: form.password,
    options: { data: metadata }
  });
  if (error) throw error;
  if (data.user) await ensureProfile(data.user, metadata);
  return data.session;
}

export async function signOut() {
  await requireClient().auth.signOut();
}

export async function ensureProfile(user, metadata = user.user_metadata || {}) {
  const profile = {
    id: user.id,
    name: metadata.name || "Moments",
    surname: metadata.surname || "",
    business_name: metadata.business_name || null,
    username: normalizeUsername(metadata.username || user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`),
    email: user.email || "",
    account_type: metadata.account_type || "personal"
  };
  const { data, error } = await requireClient().from("profiles").upsert(profile).select(profileFields).single();
  if (error) throw error;
  return data;
}

export async function loadProfile(user) {
  const { data, error } = await requireClient().from("profiles").select(profileFields).eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data || ensureProfile(user);
}

export async function loadFriends(userId) {
  const { data, error } = await requireClient()
    .from("friendships")
    .select(`friend:profiles!friendships_friend_id_fkey(${profileFields})`)
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((row) => row.friend).filter(Boolean);
}

export async function loadRequests(userId) {
  const [incoming, outgoing] = await Promise.all([
    requireClient().from("friend_requests").select(`id,sender_id,receiver_id,status,sender:profiles!friend_requests_sender_id_fkey(${profileFields})`).eq("receiver_id", userId).eq("status", "pending"),
    requireClient().from("friend_requests").select(`id,sender_id,receiver_id,status,receiver:profiles!friend_requests_receiver_id_fkey(${profileFields})`).eq("sender_id", userId).eq("status", "pending")
  ]);
  if (incoming.error) throw incoming.error;
  if (outgoing.error) throw outgoing.error;
  return { incoming: incoming.data || [], outgoing: outgoing.data || [] };
}

export async function searchUsers(userId, query, friendIds = []) {
  const clean = query.trim();
  if (!clean) return [];
  const { data, error } = await requireClient()
    .from("profiles")
    .select(profileFields)
    .or(`username.ilike.%${clean}%,name.ilike.%${clean}%,surname.ilike.%${clean}%,business_name.ilike.%${clean}%`)
    .neq("id", userId)
    .limit(20);
  if (error) throw error;
  const friends = new Set(friendIds);
  return (data || []).filter((person) => !friends.has(person.id));
}

export async function sendFriendRequest(senderId, receiverId) {
  const { data: existing, error: existingError } = await requireClient()
    .from("friend_requests")
    .select("id,sender_id,receiver_id,status")
    .eq("sender_id", senderId)
    .eq("receiver_id", receiverId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "pending") return existing;
  if (existing) {
    const { data, error } = await requireClient().from("friend_requests").update({ status: "pending" }).eq("id", existing.id).select("id,sender_id,receiver_id,status").single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await requireClient().from("friend_requests").insert({ sender_id: senderId, receiver_id: receiverId, status: "pending" }).select("id,sender_id,receiver_id,status").single();
  if (error?.code === "23505") return sendFriendRequest(senderId, receiverId);
  if (error) throw error;
  return data;
}

export async function cancelFriendRequest(id) {
  const { error } = await requireClient().from("friend_requests").delete().eq("id", id);
  if (error) throw error;
}

export async function respondFriendRequest(request, accepted) {
  const status = accepted ? "accepted" : "rejected";
  const { error } = await requireClient().from("friend_requests").update({ status }).eq("id", request.id);
  if (error) throw error;
  if (!accepted) return;
  const rows = [
    { user_id: request.sender_id, friend_id: request.receiver_id },
    { user_id: request.receiver_id, friend_id: request.sender_id }
  ];
  const { error: friendshipError } = await requireClient().from("friendships").upsert(rows);
  if (friendshipError) throw friendshipError;
  await ensureChat(request.sender_id, request.receiver_id);
}

export async function ensureChat(userId, friendId) {
  const [member_a, member_b] = [userId, friendId].sort();
  const { data, error } = await requireClient().from("chats").upsert({ member_a, member_b }, { onConflict: "member_a,member_b" }).select().single();
  if (error) throw error;
  return data;
}

export async function loadChats(userId) {
  const { data: chats, error } = await requireClient().from("chats").select("*").or(`member_a.eq.${userId},member_b.eq.${userId}`).order("updated_at", { ascending: false });
  if (error) throw error;
  const chatIds = (chats || []).map((chat) => chat.id);
  if (!chatIds.length) return { chats: [], messages: [] };
  const { data: messages, error: messageError } = await requireClient().from("messages").select("*").in("chat_id", chatIds).eq("deleted_for_everyone", false).order("created_at");
  if (messageError) throw messageError;
  return { chats: chats || [], messages: messages || [] };
}

export async function sendMessage(userId, friendId, body) {
  if (!body.trim()) return;
  const chat = await ensureChat(userId, friendId);
  const { error } = await requireClient().from("messages").insert({ chat_id: chat.id, sender_id: userId, body: body.trim() });
  if (error) throw error;
}

export async function deleteMessageForEveryone(id) {
  const { error } = await requireClient().from("messages").update({ deleted_for_everyone: true }).eq("id", id);
  if (error) throw error;
}

export async function loadIncomingMoments(userId) {
  const now = new Date().toISOString();
  const { data, error } = await requireClient()
    .from("moments")
    .select(`id,sender_id,receiver_id,storage_path,created_at,expires_at,opened_at,open_count,sender:profiles!moments_sender_id_fkey(${profileFields})`)
    .eq("receiver_id", userId)
    .lt("open_count", 2)
    .gt("expires_at", now)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendMoment(userId, receiverId, blob) {
  const isVideo = blob.type?.startsWith("video/");
  const ext = isVideo ? "webm" : "png";
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await requireClient().storage.from(appEnv.storageBucketName).upload(path, blob, { contentType: blob.type || (isVideo ? "video/webm" : "image/png") });
  if (uploadError) throw uploadError;
  const { error } = await requireClient().from("moments").insert({ sender_id: userId, receiver_id: receiverId, storage_path: path, expires_at: new Date(Date.now() + 86400000).toISOString() });
  if (error) throw error;
}

export async function signedMomentUrl(moment) {
  const { data, error } = await requireClient().storage.from(appEnv.storageBucketName).createSignedUrl(moment.storage_path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function markMomentOpened(moment, userId) {
  const now = new Date().toISOString();
  const nextCount = Math.min((moment.open_count || 0) + 1, 2);
  await requireClient().from("moment_views").upsert({ moment_id: moment.id, viewer_id: userId, viewed_at: now });
  const { error } = await requireClient().from("moments").update({ opened_at: now, open_count: nextCount }).eq("id", moment.id).eq("receiver_id", userId).lt("open_count", 2);
  if (error) throw error;
}

export async function loadDiscover() {
  const { data, error } = await requireClient().from("profiles").select(profileFields).order("total_score", { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}
