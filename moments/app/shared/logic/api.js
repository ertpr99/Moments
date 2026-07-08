import { getSupabase, hasSupabaseConfig, storageBucketName } from "./supabaseClient.js";

export async function initBackend(state) {
  state.configured = hasSupabaseConfig();
  if (!state.configured) {
    state.loading = false;
    return;
  }

  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  state.loading = false;

  if (state.session) {
    await loadAppData(state);
    subscribeRealtime(state);
  }
}

export async function signIn(state) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: state.authForm.email,
    password: state.authForm.password
  });
  if (error) throw error;
  state.session = data.session;
  await loadAppData(state);
}

export async function signUp(state) {
  const supabase = await getSupabase();
  const metadata = {
    name: state.authForm.name,
    surname: state.authForm.surname,
    username: state.authForm.username
  };
  const { data, error } = await supabase.auth.signUp({
    email: state.authForm.email,
    password: state.authForm.password,
    options: { data: metadata }
  });
  if (error) throw error;
  state.session = data.session;

  if (!data.session) {
    throw new Error("Kayıt oluşturuldu. Email doğrulaması açıksa emailini onayladıktan sonra giriş yap.");
  }

  if (data.user) {
    const profilePhotoUrl = state.authForm.profilePhoto
      ? await uploadProfilePhoto(data.user.id, state.authForm.profilePhoto)
      : null;
    await upsertProfile({
      id: data.user.id,
      name: state.authForm.name,
      surname: state.authForm.surname,
      username: state.authForm.username,
      email: state.authForm.email,
      profile_photo_url: profilePhotoUrl
    });
  }

  if (state.session) await loadAppData(state);
}

export async function signOut(state) {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  state.session = null;
  state.profile = null;
  clearData(state);
}

export async function loadAppData(state) {
  await Promise.all([
    loadProfile(state),
    loadFriends(state),
    loadRequests(state),
    loadChats(state),
    loadMoments(state),
    loadDiscover(state)
  ]);
}

export async function searchUsers(state, query) {
  state.searchQuery = query;
  const supabase = await getSupabase();
  const normalized = query.trim();
  if (!normalized) {
    state.searchResults = [];
    return;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,surname,username,profile_photo_url,total_moments_sent,total_moments_opened,friend_count")
    .or(`username.ilike.%${normalized}%,name.ilike.%${normalized}%,surname.ilike.%${normalized}%`)
    .neq("id", state.session.user.id)
    .limit(20);
  if (error) throw error;
  const friendIds = new Set(state.friends.map((friend) => friend.id));
  state.searchResults = (data || []).filter((person) => !friendIds.has(person.id));
}

export async function sendFriendRequest(state, receiverId) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("friend_requests").insert({
    sender_id: state.session.user.id,
    receiver_id: receiverId,
    status: "pending"
  });
  if (error) throw error;
  await loadRequests(state);
}

export async function respondFriendRequest(state, requestId, accepted) {
  const supabase = await getSupabase();
  const request = state.incomingRequests.find((item) => item.id === requestId);
  if (!request) return;

  const status = accepted ? "accepted" : "rejected";
  const { error } = await supabase.from("friend_requests").update({ status }).eq("id", requestId);
  if (error) throw error;

  if (accepted) {
    const rows = [
      { user_id: request.sender_id, friend_id: request.receiver_id },
      { user_id: request.receiver_id, friend_id: request.sender_id }
    ];
    const { error: friendshipError } = await supabase.from("friendships").upsert(rows);
    if (friendshipError) throw friendshipError;
    await ensureChat(state, request.sender_id);
  }

  await loadAppData(state);
}

export async function ensureChat(state, friendId) {
  const supabase = await getSupabase();
  const userId = state.session.user.id;
  const memberA = [userId, friendId].sort()[0];
  const memberB = [userId, friendId].sort()[1];
  const { data, error } = await supabase
    .from("chats")
    .upsert({ member_a: memberA, member_b: memberB }, { onConflict: "member_a,member_b" })
    .select()
    .single();
  if (error) throw error;
  await loadChats(state);
  return data;
}

export async function sendMessage(state, text) {
  const friendId = state.activeChatId;
  if (!friendId || !text.trim()) return;
  if (!state.friends.some((friend) => friend.id === friendId)) {
    throw new Error("Arkadaş olmayan kişilerle sohbet başlatılamaz.");
  }
  const chat = await ensureChat(state, friendId);
  const supabase = await getSupabase();
  const { error } = await supabase.from("messages").insert({
    chat_id: chat.id,
    sender_id: state.session.user.id,
    body: text.trim()
  });
  if (error) throw error;
  await loadChats(state);
}

export async function deleteMessageForEveryone(state, messageId) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("messages").update({ deleted_for_everyone: true }).eq("id", messageId);
  if (error) throw error;
  await loadChats(state);
}

export async function deleteMessageForSelf(state, messageId) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("message_deletions").upsert({
    message_id: messageId,
    user_id: state.session.user.id
  });
  if (error) throw error;
  await loadChats(state);
}

export async function sendMoment(state, receiverId, blob) {
  const supabase = await getSupabase();
  const userId = state.session.user.id;
  const path = `${userId}/${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage.from(storageBucketName()).upload(path, blob, {
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
  await loadMoments(state);
}

export async function openMoment(state, momentId) {
  const supabase = await getSupabase();
  const moment = state.moments.find((item) => item.id === momentId);
  if (!moment) return null;
  const { data, error } = await supabase.storage.from(storageBucketName()).createSignedUrl(moment.storage_path, 60);
  if (error) throw error;
  await supabase.from("moment_views").upsert({
    moment_id: momentId,
    viewer_id: state.session.user.id,
    viewed_at: new Date().toISOString()
  });
  await supabase.from("moments").update({ opened_at: new Date().toISOString() }).eq("id", momentId);
  await loadMoments(state);
  return data.signedUrl;
}

async function uploadProfilePhoto(userId, file) {
  const supabase = await getSupabase();
  const extension = file.name?.split(".").pop() || "jpg";
  const path = `${userId}/profile.${extension}`;
  const { error } = await supabase.storage.from(storageBucketName()).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true
  });
  if (error) throw error;
  const { data } = supabase.storage.from(storageBucketName()).getPublicUrl(path);
  return data.publicUrl;
}

async function upsertProfile(profile) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("profiles").upsert(profile);
  if (error) throw error;
}

async function loadProfile(state) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", state.session.user.id).single();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) {
    const metadata = state.session.user.user_metadata || {};
    const fallbackUsername = state.session.user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "_") || `user_${state.session.user.id.slice(0, 8)}`;
    const profile = {
      id: state.session.user.id,
      name: metadata.name || "Moments",
      surname: metadata.surname || "User",
      username: metadata.username || fallbackUsername,
      email: state.session.user.email || "",
      profile_photo_url: null
    };
    await upsertProfile(profile);
    state.profile = profile;
    return;
  }
  state.profile = data;
}

async function loadFriends(state) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("friendships")
    .select("friend:profiles!friendships_friend_id_fkey(id,name,surname,username,profile_photo_url,total_moments_sent,total_moments_opened,friend_count)")
    .eq("user_id", state.session.user.id);
  if (error) throw error;
  state.friends = (data || []).map((row) => row.friend).filter(Boolean);
}

async function loadRequests(state) {
  const supabase = await getSupabase();
  const { data: incoming, error: incomingError } = await supabase
    .from("friend_requests")
    .select("id,sender_id,receiver_id,status,created_at,sender:profiles!friend_requests_sender_id_fkey(id,name,surname,username,profile_photo_url)")
    .eq("receiver_id", state.session.user.id)
    .eq("status", "pending");
  if (incomingError) throw incomingError;

  const { data: outgoing, error: outgoingError } = await supabase
    .from("friend_requests")
    .select("id,sender_id,receiver_id,status,created_at,receiver:profiles!friend_requests_receiver_id_fkey(id,name,surname,username,profile_photo_url)")
    .eq("sender_id", state.session.user.id)
    .eq("status", "pending");
  if (outgoingError) throw outgoingError;

  state.incomingRequests = incoming || [];
  state.outgoingRequests = outgoing || [];
}

async function loadChats(state) {
  const supabase = await getSupabase();
  const userId = state.session.user.id;
  const { data: chats, error } = await supabase
    .from("chats")
    .select("id,member_a,member_b,updated_at")
    .or(`member_a.eq.${userId},member_b.eq.${userId}`)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  state.chats = chats || [];

  const chatIds = state.chats.map((chat) => chat.id);
  if (!chatIds.length) {
    state.messages = [];
    return;
  }
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
  const hiddenIds = new Set((deletions || []).map((item) => item.message_id));
  state.messages = (messages || []).filter((message) => !hiddenIds.has(message.id));
}

async function loadMoments(state) {
  const supabase = await getSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("moments")
    .select("id,sender_id,receiver_id,storage_path,created_at,expires_at,opened_at,sender:profiles!moments_sender_id_fkey(id,name,surname,username,profile_photo_url)")
    .eq("receiver_id", state.session.user.id)
    .is("opened_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false });
  if (error) throw error;
  state.moments = (data || []).map((moment) => ({ ...moment, expired: false }));
}

async function loadDiscover(state) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,surname,username,profile_photo_url,total_moments_sent,total_moments_opened,friend_count")
    .order("total_score", { ascending: false })
    .limit(50);
  if (error) throw error;
  state.discover = data || [];
}

function subscribeRealtime(state) {
  getSupabase().then((supabase) => {
    supabase
      .channel("moments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => loadChats(state))
      .on("postgres_changes", { event: "*", schema: "public", table: "moments" }, () => loadMoments(state))
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => loadRequests(state))
      .subscribe();
  });
}

function clearData(state) {
  state.people = [];
  state.friends = [];
  state.incomingRequests = [];
  state.outgoingRequests = [];
  state.chats = [];
  state.messages = [];
  state.moments = [];
  state.discover = [];
  state.searchResults = [];
}
