import { appEnv, supabase } from "./supabase.js";

export const usernamePattern = /^[a-z0-9_.]+$/;

const profileFields = [
  "id",
  "name",
  "surname",
  "business_name",
  "account_type",
  "username",
  "email",
  "profile_photo_url",
  "is_verified",
  "verified_type",
  "total_moments_sent",
  "total_moments_opened",
  "friend_count",
  "name_changed_at",
  "username_changed_at",
  "account_type_changed_at",
  "frozen_until",
  "freeze_requested_at",
  "delete_requested_at",
  "deleted_at",
  "total_score"
].join(",");

export function fullName(profile) {
  if (profile?.account_type === "business" && profile?.business_name) return profile.business_name;
  return [profile?.name, profile?.surname].filter(Boolean).join(" ") || profile?.username || "Moments";
}

export function initials(profile) {
  const label = fullName(profile);
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "MO";
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

export function normalizeUsername(value) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!username) return { ok: false, username, message: "Kullanıcı adı gerekli." };
  if (username.includes(" ")) return { ok: false, username, message: "Boşluk kullanılamaz." };
  if (!usernamePattern.test(username)) return { ok: false, username, message: "Sadece küçük harf, rakam, _ ve . kullanılabilir." };
  if (username.length < 3) return { ok: false, username, message: "En az 3 karakter olmalı." };
  return { ok: true, username, message: "Kullanılabilir format." };
}

export function profileCompatibilityIssues(profile) {
  const issues = [];
  const accountType = profile?.account_type || "personal";
  const rawUsername = profile?.username || "";

  if (!profile?.account_type) issues.push("Hesap türü seçilmeli.");
  if (!rawUsername) issues.push("Kullanıcı adı gerekli.");
  if (rawUsername !== rawUsername.toLowerCase()) issues.push("Kullanıcı adı küçük harf olmalı.");
  if (rawUsername.includes(" ")) issues.push("Kullanıcı adında boşluk olamaz.");
  if (rawUsername.includes("@")) issues.push("Kullanıcı adı @ işareti olmadan kaydedilmeli.");
  if (rawUsername && !usernamePattern.test(rawUsername)) issues.push("Kullanıcı adı sadece küçük harf, rakam, _ ve . içermeli.");
  if (accountType === "business" && !profile?.business_name) issues.push("Ticari hesap için işletme adı gerekli.");
  if (accountType !== "business" && (!profile?.name || !profile?.surname)) issues.push("Kişisel hesap için ad ve soyad gerekli.");

  return issues;
}

export function isProfileCompatible(profile) {
  return profileCompatibilityIssues(profile).length === 0;
}

export function canChangeAfter(dateValue, days) {
  if (!dateValue) return true;
  return Date.now() - new Date(dateValue).getTime() >= days * 24 * 60 * 60 * 1000;
}

export function isFrozen(profile) {
  return profile?.frozen_until && new Date(profile.frozen_until).getTime() > Date.now();
}

export function isDeletePending(profile) {
  return profile?.delete_requested_at && !profile?.deleted_at;
}

function storagePathFromValue(value) {
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return value;
  const marker = `/storage/v1/object/public/${appEnv.storageBucketName}/`;
  const index = value.indexOf(marker);
  if (index === -1) return "";
  return decodeURIComponent(value.slice(index + marker.length));
}

async function withPhotoUrl(profile) {
  if (!profile?.profile_photo_url) return profile;
  const path = storagePathFromValue(profile.profile_photo_url);
  if (!path) return profile;
  const { data, error } = await supabase.storage.from(appEnv.storageBucketName).createSignedUrl(path, 60 * 60);
  if (error) return profile;
  return { ...profile, profile_photo_url: data.signedUrl };
}

async function withPhotoUrls(profiles) {
  return Promise.all((profiles || []).map((profile) => withPhotoUrl(profile)));
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
  const usernameCheck = validateUsername(form.username);
  if (!usernameCheck.ok) throw new Error(usernameCheck.message);

  const accountType = form.accountType === "business" ? "business" : "personal";
  const email = form.email.trim().toLowerCase();
  const profilePayload = {
    name: accountType === "personal" ? form.name.trim() : "",
    surname: accountType === "personal" ? form.surname.trim() : "",
    business_name: accountType === "business" ? form.businessName.trim() : null,
    account_type: accountType,
    username: usernameCheck.username,
    email
  };

  const { data, error } = await supabase.auth.signUp({
    email,
    password: form.password,
    options: { data: profilePayload }
  });
  if (error) throw error;
  if (!data.session) throw new Error("Kayıt oluşturuldu. E-posta doğrulaması açıksa e-postanı onaylayıp giriş yap.");

  await upsertProfile({ id: data.user.id, ...profilePayload });
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
  if (data) return withPhotoUrl(data);
  if (error && error.code !== "PGRST116") throw error;

  const metadata = user.user_metadata || {};
  const fallback = {
    id: user.id,
    name: metadata.name || "Moments",
    surname: metadata.surname || "User",
    business_name: metadata.business_name || null,
    account_type: metadata.account_type || "personal",
    username: metadata.username || user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase(),
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
  const path = `${userId}/profile-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(appEnv.storageBucketName).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true
  });
  if (error) throw error;
  return path;
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
  return withPhotoUrl(data);
}

export async function updateProfileDetails(profile, form) {
  const now = new Date().toISOString();
  const accountType = form.accountType === "business" ? "business" : "personal";
  const usernameCheck = validateUsername(form.username);
  if (!usernameCheck.ok) throw new Error(usernameCheck.message);

  const payload = {
    name: accountType === "personal" ? (form.name || "").trim() : "",
    surname: accountType === "personal" ? (form.surname || "").trim() : "",
    business_name: accountType === "business" ? (form.businessName || "").trim() : null,
    account_type: accountType,
    username: usernameCheck.username
  };

  const wasCompatible = isProfileCompatible(profile);
  const currentName = fullName(profile);
  const nextName = accountType === "business" ? payload.business_name : [payload.name, payload.surname].filter(Boolean).join(" ");
  if (accountType === "personal" && (!payload.name || !payload.surname)) throw new Error("Kişisel hesap için ad ve soyad gerekli.");
  if (accountType === "business" && !payload.business_name) throw new Error("Ticari hesap için işletme adı gerekli.");
  if (currentName !== nextName) {
    if (wasCompatible && !canChangeAfter(profile.name_changed_at, 30)) throw new Error("Ad bilgisi 30 günde bir değiştirilebilir.");
    payload.name_changed_at = now;
  }
  if (profile.username !== payload.username) {
    if (wasCompatible && !canChangeAfter(profile.username_changed_at, 14)) throw new Error("Kullanıcı adı 14 günde bir değiştirilebilir.");
    payload.username_changed_at = now;
  }
  if ((profile.account_type || "personal") !== accountType) {
    if (wasCompatible && !canChangeAfter(profile.account_type_changed_at, 30)) throw new Error("Hesap türü 30 günde bir değiştirilebilir.");
    payload.account_type_changed_at = now;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", profile.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function checkUsernameAvailable(username, currentUserId) {
  const check = validateUsername(username);
  if (!check.ok) return { ...check, available: false };
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", check.username)
    .maybeSingle();
  if (error) throw error;
  return { ...check, available: !data || data.id === currentUserId };
}

export async function freezeProfile(profile) {
  if (!canChangeAfter(profile.freeze_requested_at, 7)) throw new Error("Profil dondurma hakkı 7 günde bir kullanılabilir.");
  const frozenUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("profiles")
    .update({ frozen_until: frozenUntil, freeze_requested_at: new Date().toISOString() })
    .eq("id", profile.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function unfreezeProfile(profileId) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ frozen_until: null })
    .eq("id", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function requestProfileDeletion(profile) {
  if (!canChangeAfter(profile.delete_requested_at, 14)) throw new Error("Silme talebi 14 günde bir oluşturulabilir.");
  const { data, error } = await supabase
    .from("profiles")
    .update({ delete_requested_at: new Date().toISOString() })
    .eq("id", profile.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelProfileDeletion(profileId) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ delete_requested_at: null })
    .eq("id", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

function activeProfileFilter(query) {
  return query.is("deleted_at", null);
}

export async function loadFriends(userId) {
  const { data, error } = await supabase
    .from("friendships")
    .select(`friend:profiles!friendships_friend_id_fkey(${profileFields})`)
    .eq("user_id", userId);
  if (error) throw error;
  return withPhotoUrls((data || []).map((row) => row.friend).filter((friend) => friend && !isFrozen(friend) && !friend.deleted_at));
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

  return {
    incoming: await Promise.all((incoming || []).filter((request) => request.sender && !isFrozen(request.sender) && !request.sender.deleted_at).map(async (request) => ({ ...request, sender: await withPhotoUrl(request.sender) }))),
    outgoing: await Promise.all((outgoing || []).map(async (request) => ({ ...request, receiver: await withPhotoUrl(request.receiver) })))
  };
}

async function friendshipExists(userId, friendId) {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id")
    .eq("user_id", userId)
    .eq("friend_id", friendId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function setExistingRequestPending(requestId) {
  const { data, error } = await supabase
    .from("friend_requests")
    .update({ status: "pending" })
    .eq("id", requestId)
    .select("id,sender_id,receiver_id,status,created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function searchUsers(userId, query, friendIds = []) {
  const clean = query.trim();
  if (!clean) return [];
  let request = supabase
    .from("profiles")
    .select(profileFields)
    .or(`username.ilike.%${clean}%,name.ilike.%${clean}%,surname.ilike.%${clean}%,business_name.ilike.%${clean}%`)
    .neq("id", userId)
    .limit(20);
  request = activeProfileFilter(request);
  const { data, error } = await request;
  if (error) throw error;
  const friends = new Set(friendIds);
  return withPhotoUrls((data || []).filter((person) => !friends.has(person.id) && !isFrozen(person) && isProfileCompatible(person)));
}

async function sendFriendRequestLegacy(senderId, receiverId) {
  const { data: existing, error: existingError } = await supabase
    .from("friend_requests")
    .select("id,sender_id,receiver_id,status,created_at")
    .eq("sender_id", senderId)
    .eq("receiver_id", receiverId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.status === "pending") return existing;
  if (existing?.status === "accepted") throw new Error("Bu kullanıcıyla zaten arkadaşlık isteği tamamlanmış.");
  if (existing?.status === "rejected") {
    const { data, error } = await supabase
      .from("friend_requests")
      .update({ status: "pending" })
      .eq("id", existing.id)
      .select("id,sender_id,receiver_id,status,created_at")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from("friend_requests").insert({
    sender_id: senderId,
    receiver_id: receiverId,
    status: "pending"
  }).select("id,sender_id,receiver_id,status,created_at").single();
  if (error) throw error;
  return data;
}

export async function sendFriendRequest(senderId, receiverId) {
  const { data: existing, error: existingError } = await supabase
    .from("friend_requests")
    .select("id,sender_id,receiver_id,status,created_at")
    .eq("sender_id", senderId)
    .eq("receiver_id", receiverId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.status === "pending") return existing;
  if (existing?.status === "accepted") {
    if (await friendshipExists(senderId, receiverId)) throw new Error("Bu kullanici zaten arkadasin.");
    return setExistingRequestPending(existing.id);
  }
  if (existing?.status === "rejected") return setExistingRequestPending(existing.id);

  const { data, error } = await supabase.from("friend_requests").insert({
    sender_id: senderId,
    receiver_id: receiverId,
    status: "pending"
  }).select("id,sender_id,receiver_id,status,created_at").single();

  if (error?.code === "23505") {
    const { data: duplicate, error: duplicateError } = await supabase
      .from("friend_requests")
      .select("id,sender_id,receiver_id,status,created_at")
      .eq("sender_id", senderId)
      .eq("receiver_id", receiverId)
      .single();
    if (duplicateError) throw duplicateError;
    if (duplicate.status === "pending") return duplicate;
    if (duplicate.status === "accepted" && await friendshipExists(senderId, receiverId)) throw new Error("Bu kullanici zaten arkadasin.");
    return setExistingRequestPending(duplicate.id);
  }
  if (error) throw error;
  return data;
}

export async function cancelFriendRequest(requestId) {
  const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
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
    const { error: friendshipError } = await supabase.from("friendships").insert(rows);
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
    .select(`id,sender_id,receiver_id,storage_path,created_at,expires_at,opened_at,open_count,sender:profiles!moments_sender_id_fkey(${profileFields})`)
    .eq("receiver_id", userId)
    .lt("open_count", 2)
    .gt("expires_at", now)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data || []).filter((moment) => moment.sender && !isFrozen(moment.sender) && !moment.sender.deleted_at).map(async (moment) => ({ ...moment, sender: await withPhotoUrl(moment.sender) })));
}

export async function loadMomentReceipts(userId) {
  const { data, error } = await supabase
    .from("moments")
    .select("id,receiver_id,storage_path,created_at,opened_at,open_count")
    .eq("sender_id", userId)
    .gt("open_count", 0)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}

export async function sendMoment(userId, receiverId, blob) {
  const isVideo = blob.type?.startsWith("video/");
  const ext = isVideo ? "webm" : "png";
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(appEnv.storageBucketName).upload(path, blob, {
    contentType: blob.type || (isVideo ? "video/webm" : "image/png"),
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
  const { data: moment, error: momentError } = await supabase
    .from("moments")
    .select("open_count")
    .eq("id", momentId)
    .eq("receiver_id", userId)
    .single();
  if (momentError) throw momentError;
  if ((moment.open_count || 0) >= 2) return;

  const { error: viewError } = await supabase.from("moment_views").upsert({
    moment_id: momentId,
    viewer_id: userId,
    viewed_at: now
  });
  if (viewError) throw viewError;
  const { error } = await supabase
    .from("moments")
    .update({ opened_at: now, open_count: Math.min((moment.open_count || 0) + 1, 2) })
    .eq("id", momentId)
    .eq("receiver_id", userId)
    .lt("open_count", 2);
  if (error) throw error;
}

export async function loadDiscover() {
  let request = supabase
    .from("profiles")
    .select(profileFields)
    .order("total_score", { ascending: false })
    .limit(50);
  request = activeProfileFilter(request);
  const { data, error } = await request;
  if (error) throw error;
  return withPhotoUrls((data || []).filter((person) => !isFrozen(person) && isProfileCompatible(person)));
}
