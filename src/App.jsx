import { useEffect, useRef, useState } from "react";
import {
  cancelProfileDeletion,
  checkUsernameAvailable,
  deleteMessageForEveryone,
  deleteMessageForSelf,
  freezeProfile,
  fullName,
  getProfile,
  getSession,
  initials,
  isDeletePending,
  isFrozen,
  isProfileCompatible,
  loadChats,
  loadDiscover,
  loadFriends,
  loadIncomingMoments,
  loadRequests,
  markMomentOpened,
  normalizeUsername,
  openMoment,
  profileCompatibilityIssues,
  requestProfileDeletion,
  respondFriendRequest,
  score,
  searchUsers,
  sendFriendRequest,
  sendMessage,
  sendMoment,
  signIn,
  signOut,
  signUp,
  unfreezeProfile,
  updateProfileDetails,
  updateProfilePhoto,
  validateUsername,
  verificationLabel
} from "./lib/api.js";
import { hasSupabaseConfig, supabase } from "./lib/supabase.js";

const tabs = [
  { id: "friends", label: "Arkadaşlar", icon: "A" },
  { id: "camera", label: "Kamera", icon: "K" },
  { id: "chat", label: "Sohbet", icon: "S" },
  { id: "discover", label: "Keşfet", icon: "D" },
  { id: "profile", label: "Profil", icon: "P" },
  { id: "settings", label: "Ayarlar", icon: "T" }
];

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("moments-theme") || "light");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState("friends");
  const [authMode, setAuthMode] = useState("signin");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [incomingMoments, setIncomingMoments] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [activeMoment, setActiveMoment] = useState(null);
  const [returnToChatId, setReturnToChatId] = useState("");
  const [capturedMoment, setCapturedMoment] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState("");
  const [profileView, setProfileView] = useState(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState("capture");
  const [selectedReceivers, setSelectedReceivers] = useState([]);
  const [hideMomentWarning, setHideMomentWarning] = useState(() => localStorage.getItem("moments-hide-send-warning") === "1");
  const [showMomentWarning, setShowMomentWarning] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const touchRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("moments-theme", theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      if (!hasSupabaseConfig) {
        setLoading(false);
        return;
      }
      try {
        const current = await getSession();
        if (!mounted) return;
        setSession(current);
        if (current) await refreshAll(current.user);
      } catch (err) {
        setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();

    if (!supabase) return () => {
      mounted = false;
    };

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) await refreshAll(nextSession.user);
      else clearAppState();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !supabase) return undefined;
    const channel = supabase
      .channel("moments-client")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refreshAll(session.user))
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refreshChats(session.user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "moments" }, () => refreshMoments(session.user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => refreshRequests(session.user.id))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  async function refreshAll(user = session?.user) {
    if (!user) return;
    const nextProfile = await getProfile(user);
    setProfile(nextProfile);

    const [nextFriends, nextRequests, nextChats, nextMoments, nextDiscover] = await Promise.all([
      loadFriends(user.id).catch(() => []),
      loadRequests(user.id).catch(() => ({ incoming: [], outgoing: [] })),
      loadChats(user.id).catch(() => ({ chats: [], messages: [] })),
      loadIncomingMoments(user.id).catch(() => []),
      loadDiscover().catch(() => [])
    ]);
    setFriends(nextFriends);
    setRequests(nextRequests);
    setChats(nextChats.chats);
    setMessages(nextChats.messages);
    setIncomingMoments(nextMoments);
    setDiscover(nextDiscover);
  }

  async function refreshRequests(userId = session?.user?.id) {
    if (userId) setRequests(await loadRequests(userId));
  }

  async function refreshChats(userId = session?.user?.id) {
    if (!userId) return;
    const next = await loadChats(userId);
    setChats(next.chats);
    setMessages(next.messages);
  }

  async function refreshMoments(userId = session?.user?.id) {
    if (userId) setIncomingMoments(await loadIncomingMoments(userId));
  }

  function clearAppState() {
    setProfile(null);
    setFriends([]);
    setRequests({ incoming: [], outgoing: [] });
    setSearchResults([]);
    setChats([]);
    setMessages([]);
    setIncomingMoments([]);
    setDiscover([]);
    setActiveChatId("");
    setActiveMoment(null);
  }

  async function run(action, successMessage) {
    try {
      setError("");
      setNotice("");
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(err.message);
      setNotice(err.message);
    }
  }

  function goTo(tabId) {
    if (screen === "camera" && cameraMode === "capture") return;
    setScreen(tabId);
    if (tabId !== "chat") setActiveChatId("");
  }

  function handleTouchStart(event) {
    touchRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  function handleTouchEnd(event) {
    if (!touchRef.current || screen === "camera") return;
    const dx = event.changedTouches[0].clientX - touchRef.current.x;
    const dy = event.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) < 54 || Math.abs(dx) < Math.abs(dy)) return;
    const index = tabs.findIndex((tab) => tab.id === screen);
    const next = dx < 0 ? index + 1 : index - 1;
    if (tabs[next]) goTo(tabs[next].id);
  }

  if (loading) return <Shell theme={theme} setTheme={setTheme}><CenterState title="Moments" text="Hazırlanıyor..." /></Shell>;
  if (!hasSupabaseConfig) return <Shell theme={theme} setTheme={setTheme}><CenterState title="Supabase gerekli" text="SUPABASE_URL ve SUPABASE_ANON_KEY tanımlanmalı." /></Shell>;
  if (!session) {
    return (
      <Shell theme={theme} setTheme={setTheme} compact>
        <AuthScreen
          mode={authMode}
          setMode={setAuthMode}
          onUsernameCheck={(username) => checkUsernameAvailable(username)}
          onSubmit={(form) => run(async () => {
            const nextSession = authMode === "signin" ? await signIn(form.email, form.password) : await signUp(form);
            setSession(nextSession);
            await refreshAll(nextSession.user);
          })}
          error={error}
        />
      </Shell>
    );
  }

  const activeFriend = friends.find((friend) => friend.id === activeChatId);
  const profileIsCompatible = isProfileCompatible(profile);

  return (
    <Shell
      theme={theme}
      setTheme={setTheme}
      notice={notice}
      title={activeFriend && screen === "chat" ? fullName(activeFriend) : tabs.find((tab) => tab.id === screen)?.label || "Moments"}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      hideChrome={screen === "camera" && cameraMode === "capture"}
      action={screen === "profile" ? <button className="icon-button" onClick={() => setProfileEditing(true)} title="Düzenle">✎</button> : null}
    >
      {screen === "friends" && (
        <FriendsScreen
          friends={friends}
          requests={requests}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          onSearch={(query) => run(async () => setSearchResults(await searchUsers(session.user.id, query, friends.map((friend) => friend.id))))}
          onProfile={setProfileView}
          onChat={(friend) => {
            setActiveChatId(friend.id);
            setScreen("chat");
          }}
          onRequest={(personId) => run(async () => {
            await sendFriendRequest(session.user.id, personId);
            setSearchResults([]);
            setSearchQuery("");
            await refreshRequests();
          }, "Arkadaş isteği gönderildi.")}
          onRespond={(request, accepted) => run(async () => {
            await respondFriendRequest(request, accepted);
            await refreshAll();
          }, accepted ? "Arkadaş eklendi." : "İstek reddedildi.")}
        />
      )}

      {screen === "camera" && (
        <CameraScreen
          friends={friends}
          incomingMoments={incomingMoments}
          capturedMoment={capturedMoment}
          setCapturedMoment={setCapturedMoment}
          mode={cameraMode}
          setMode={setCameraMode}
          selectedReceivers={selectedReceivers}
          setSelectedReceivers={setSelectedReceivers}
          hideMomentWarning={hideMomentWarning}
          setHideMomentWarning={(value) => {
            setHideMomentWarning(value);
            localStorage.setItem("moments-hide-send-warning", value ? "1" : "0");
          }}
          showWarning={showMomentWarning}
          setShowWarning={setShowMomentWarning}
          onSend={(receiverIds) => run(async () => {
            if (!profileIsCompatible) throw new Error("Aktif sosyal işlemler için önce profil bilgilerini güncelle.");
            if (!capturedMoment?.blob) throw new Error("Önce kamera ile Moment çek.");
            if (!receiverIds.length) throw new Error("Moment göndermek için arkadaş seç.");
            const blocked = receiverIds.filter((id) => incomingMoments.some((moment) => moment.sender_id === id));
            if (blocked.length && !hideMomentWarning) {
              setShowMomentWarning(true);
              return;
            }
            for (const receiverId of receiverIds.filter((id) => !blocked.includes(id))) {
              await sendMoment(session.user.id, receiverId, capturedMoment.blob);
            }
            setCapturedMoment(null);
            setSelectedReceivers([]);
            setCameraMode("capture");
            setScreen("chat");
            await refreshMoments();
          }, "Moment gönderildi.")}
        />
      )}

      {screen === "chat" && !activeChatId && (
        <ChatList
          friends={friends}
          chats={chats}
          messages={messages}
          incomingMoments={incomingMoments}
          userId={session.user.id}
          query={chatSearch}
          setQuery={setChatSearch}
          onOpen={(friendId) => run(async () => {
            const moment = incomingMoments.find((item) => item.sender_id === friendId);
            setActiveChatId(friendId);
            if (moment) {
              const signedUrl = await openMoment(moment);
              setReturnToChatId(friendId);
              setActiveMoment({ ...moment, signedUrl });
            }
          })}
        />
      )}

      {screen === "chat" && activeChatId && !activeMoment && (
        <ChatDetail
          userId={session.user.id}
          friend={activeFriend}
          chat={chatForFriend(chats, session.user.id, activeChatId)}
          messages={messages}
          menuId={messageMenuId}
          setMenuId={setMessageMenuId}
          onBack={() => setActiveChatId("")}
          onSend={(body) => run(async () => {
            if (!profileIsCompatible) throw new Error("Mesaj göndermek için önce profil bilgilerini güncelle.");
            await sendMessage(session.user.id, activeChatId, body);
            await refreshChats();
          })}
          onDeleteEveryone={(id) => run(async () => {
            await deleteMessageForEveryone(id);
            setMessageMenuId("");
            await refreshChats();
          })}
          onDeleteSelf={(id) => run(async () => {
            await deleteMessageForSelf(id, session.user.id);
            setMessageMenuId("");
            await refreshChats();
          })}
        />
      )}

      {activeMoment && (
        <MomentViewer
          moment={activeMoment}
          onClose={() => run(async () => {
            await markMomentOpened(activeMoment.id, session.user.id);
            setActiveMoment(null);
            setActiveChatId(returnToChatId);
            setReturnToChatId("");
            await refreshAll();
          })}
        />
      )}

      {screen === "discover" && <DiscoverScreen people={discover} onProfile={setProfileView} />}
      {screen === "profile" && <ProfileScreen profile={profile} friends={friends} onEdit={() => setProfileEditing(true)} />}
      {screen === "settings" && (
        <SettingsScreen
          profile={profile}
          theme={theme}
          setTheme={setTheme}
          onRules={() => setRulesOpen(true)}
          onFreeze={() => run(async () => setProfile(await freezeProfile(profile)), "Profil donduruldu.")}
          onUnfreeze={() => run(async () => setProfile(await unfreezeProfile(profile.id)), "Profil yeniden açıldı.")}
          onDelete={() => run(async () => setProfile(await requestProfileDeletion(profile)), "Silme talebi oluşturuldu.")}
          onCancelDelete={() => run(async () => setProfile(await cancelProfileDeletion(profile.id)), "Silme talebi iptal edildi.")}
          onSignOut={() => run(signOut)}
        />
      )}

      {profileView && <ProfileModal person={profileView} isFriend={friends.some((friend) => friend.id === profileView.id)} onClose={() => setProfileView(null)} onRequest={(id) => run(async () => sendFriendRequest(session.user.id, id), "Arkadaş isteği gönderildi.")} onChat={(person) => { setProfileView(null); setActiveChatId(person.id); setScreen("chat"); }} />}
      {profileEditing && <ProfileEditor profile={profile} onClose={() => setProfileEditing(false)} onUsernameCheck={(username) => checkUsernameAvailable(username, profile.id)} onPhotoUpload={(file) => run(async () => setProfile(await updateProfilePhoto(profile.id, file)), "Profil fotoğrafı güncellendi.")} onSave={(form) => run(async () => { setProfile(await updateProfileDetails(profile, form)); setProfileEditing(false); }, "Profil güncellendi.")} />}
      {rulesOpen && <RulesScreen onClose={() => setRulesOpen(false)} />}
      {error && <div className="toast">{error}</div>}
      <nav className="bottom-nav">
        {tabs.map((tab) => (
          <button key={tab.id} className={screen === tab.id ? "active" : ""} onClick={() => goTo(tab.id)}>
            <span>{tab.icon}</span>
            <small>{tab.label}</small>
          </button>
        ))}
      </nav>
    </Shell>
  );
}

function Shell({ children, notice, title = "Moments", compact = false, hideChrome = false, action, onTouchStart, onTouchEnd }) {
  return (
    <main className="app-shell">
      <section className={`${compact ? "phone-app auth-frame" : "phone-app"} ${hideChrome ? "camera-frame" : ""}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {!hideChrome && (
          <header className="top-bar">
            <div>
              <p>Moments</p>
              <h1>{title}</h1>
            </div>
            <div className="top-actions">
              {action}
            </div>
          </header>
        )}
        <div className="screen">{children}</div>
        {notice && <div className="toast">{notice}</div>}
      </section>
    </main>
  );
}

function CenterState({ title, text }) {
  return <section className="center-state"><h2>{title}</h2><p>{text}</p></section>;
}

function AuthScreen({ mode, setMode, onSubmit, onUsernameCheck, error }) {
  const signup = mode === "signup";
  const [form, setForm] = useState({ accountType: "personal", name: "", surname: "", businessName: "", username: "", email: "", password: "" });
  const [usernameState, setUsernameState] = useState(null);

  useEffect(() => {
    if (!signup || !form.username) {
      setUsernameState(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      const local = validateUsername(form.username);
      if (!local.ok) {
        setUsernameState({ ok: false, message: local.message });
        return;
      }
      try {
        const result = await onUsernameCheck(form.username);
        setUsernameState(result.available ? { ok: true, message: "Kullanıcı adı uygun." } : { ok: false, message: "Bu kullanıcı adı dolu." });
      } catch {
        setUsernameState({ ok: false, message: "Kullanıcı adı kontrol edilemedi." });
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [form.username, signup]);

  return (
    <section className="auth-screen">
      <div className="auth-intro"><h2>Moments'a hoş geldin.</h2></div>
      <div className="segmented auth-toggle">
        <button type="button" className={!signup ? "selected" : ""} onClick={() => setMode("signin")}>Giriş</button>
        <button type="button" className={signup ? "selected" : ""} onClick={() => setMode("signup")}>Kayıt</button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="form auth-form">
        {signup && (
          <>
            <div className="form-group">
              <span>Hesap Türü</span>
              <div className="segmented">
                <button type="button" className={form.accountType === "personal" ? "selected" : ""} onClick={() => setForm({ ...form, accountType: "personal" })}>Kişisel</button>
                <button type="button" className={form.accountType === "business" ? "selected" : ""} onClick={() => setForm({ ...form, accountType: "business" })}>Ticari</button>
              </div>
            </div>
            {form.accountType === "business" ? (
              <input placeholder="İşletme Adı" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} required />
            ) : (
              <>
                <input placeholder="Ad" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                <input placeholder="Soyad" value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} required />
              </>
            )}
            <div className="username-field">
              <span>@</span>
              <input placeholder="kullanici_adi" value={form.username} onChange={(event) => setForm({ ...form, username: normalizeUsername(event.target.value) })} required />
            </div>
            {usernameState && <small className={usernameState.ok ? "field-ok" : "field-error"}>{usernameState.message}</small>}
          </>
        )}
        <input type="email" placeholder="E-posta" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input type="password" placeholder="Şifre" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={6} />
        <button>{signup ? "Kayıt Ol" : "Giriş Yap"}</button>
      </form>
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}

function FriendsScreen({ friends, requests, searchQuery, setSearchQuery, searchResults, onSearch, onRequest, onRespond, onProfile, onChat }) {
  const [open, setOpen] = useState({ friends: friends.length > 0, requests: requests.incoming.length > 0 });
  const [menuId, setMenuId] = useState("");

  useEffect(() => {
    if (friends.length) setOpen((state) => ({ ...state, friends: true }));
    if (requests.incoming.length) setOpen((state) => ({ ...state, requests: true }));
  }, [friends.length, requests.incoming.length]);

  return (
    <section className="stack">
      <label className="search-box">
        <span>Kullanıcı ara</span>
        <input value={searchQuery} placeholder="Ad veya @username ara" onChange={(event) => {
          setSearchQuery(event.target.value);
          onSearch(event.target.value);
        }} />
      </label>
      {searchQuery && (
        <div className="panel-list">
          {searchResults.length ? searchResults.map((person) => (
            <button className="person-card as-button" key={person.id} onClick={() => onProfile(person)}>
              <Avatar person={person} />
              <PersonText person={person} />
            </button>
          )) : <Empty text="Kullanıcı bulunamadı." />}
        </div>
      )}

      <Accordion title={requests.incoming.length ? "Arkadaş İstekleri" : "Henüz gelen istek yok."} count={requests.incoming.length} active={requests.incoming.length > 0} open={open.requests} onToggle={() => setOpen({ ...open, requests: !open.requests })}>
        {requests.incoming.map((request) => (
          <article className="person-card" key={request.id}>
            <Avatar person={request.sender} />
            <PersonText person={request.sender} />
            <div className="person-actions">
              <button className="small-action" onClick={() => onRespond(request, true)}>Kabul</button>
              <button className="small-action muted" onClick={() => onRespond(request, false)}>Reddet</button>
            </div>
          </article>
        ))}
      </Accordion>

      <Accordion title={friends.length ? "Arkadaşlar" : "Henüz arkadaşın yok."} count={friends.length} active={friends.length > 0} open={open.friends} onToggle={() => setOpen({ ...open, friends: !open.friends })}>
        {friends.map((friend) => (
          <article className="person-card friend-row" key={friend.id} onClick={() => setMenuId(menuId === friend.id ? "" : friend.id)}>
            <Avatar person={friend} />
            <PersonText person={friend} />
            {menuId === friend.id && (
              <div className="person-actions">
                <button className="small-action" onClick={(event) => { event.stopPropagation(); onProfile(friend); }}>Profili Gör</button>
                <button className="small-action muted" onClick={(event) => { event.stopPropagation(); onChat(friend); }}>Mesaj Gönder</button>
              </div>
            )}
          </article>
        ))}
      </Accordion>
    </section>
  );
}

function Accordion({ title, count, active, open, onToggle, children }) {
  return (
    <section className={`accordion ${active ? "active" : ""}`}>
      <button className="accordion-head" onClick={onToggle}>
        <strong>{title}</strong>
        <span>{count}</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </section>
  );
}

function ChatList({ friends, chats, messages, incomingMoments, userId, query, setQuery, onOpen }) {
  const filtered = friends.filter((friend) => fullName(friend).toLowerCase().includes(query.toLowerCase()) || friend.username?.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="stack">
      <label className="search-box">
        <span>Sohbet ara</span>
        <input value={query} placeholder="Sadece mevcut sohbetler" onChange={(event) => setQuery(event.target.value)} />
      </label>
      {filtered.length ? filtered.map((friend) => {
        const chat = chatForFriend(chats, userId, friend.id);
        const hasMessage = chat ? messages.some((message) => message.chat_id === chat.id) : false;
        const hasMoment = incomingMoments.some((moment) => moment.sender_id === friend.id);
        return (
          <button className="chat-row" key={friend.id} onClick={() => onOpen(friend.id)}>
            <Avatar person={friend} />
            <PersonText person={friend} compact />
            <div className="status-dots">
              {hasMoment && <span className="status-dot moment-dot" />}
              {hasMessage && <span className="status-dot message-dot" />}
            </div>
          </button>
        );
      }) : <Empty text="Henüz sohbet yok." />}
    </section>
  );
}

function ChatDetail({ userId, friend, chat, messages, menuId, setMenuId, onBack, onSend, onDeleteEveryone, onDeleteSelf }) {
  const [body, setBody] = useState("");
  const visibleMessages = chat ? messages.filter((message) => message.chat_id === chat.id) : [];
  return (
    <section className="stack chat-detail">
      <button className="back-button" onClick={onBack}>Geri</button>
      <div className="chat-person"><Avatar person={friend} /><PersonText person={friend} compact /></div>
      <div className="chat-list">
        {visibleMessages.length ? visibleMessages.map((message) => (
          <article className={`bubble ${message.sender_id === userId ? "mine" : ""}`} key={message.id} onDoubleClick={() => setMenuId(menuId === message.id ? "" : message.id)}>
            <small>{new Date(message.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</small>
            <p>{message.body}</p>
            {menuId === message.id && (
              <div className="message-menu">
                <button onClick={() => onDeleteEveryone(message.id)}>Herkesten sil</button>
                <button onClick={() => onDeleteSelf(message.id)}>Kendim için sil</button>
              </div>
            )}
          </article>
        )) : <Empty text="Henüz mesaj yok." />}
      </div>
      <form className="message-form" onSubmit={(event) => {
        event.preventDefault();
        onSend(body);
        setBody("");
      }}>
        <input placeholder="Mesaj yaz" value={body} onChange={(event) => setBody(event.target.value)} />
        <button>Gönder</button>
      </form>
    </section>
  );
}

function CameraScreen({ friends, incomingMoments, capturedMoment, setCapturedMoment, mode, setMode, selectedReceivers, setSelectedReceivers, hideMomentWarning, setHideMomentWarning, showWarning, setShowWarning, onSend }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState(null);
  const shutterDragRef = useRef(null);
  const lenses = [0.5, 1, 2, 3, 5];
  const blockedIds = selectedReceivers.filter((id) => incomingMoments.some((moment) => moment.sender_id === id));
  const blockedFriends = friends.filter((friend) => blockedIds.includes(friend.id));

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 4096 },
            height: { ideal: 2160 }
          },
          audio: false
        });
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        applyCameraZoom(zoom, stream);
        setCameraError("");
      } catch {
        setCameraError("Kamera izni gerekli.");
      }
    }
    start();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode]);

  useEffect(() => {
    applyCameraZoom(zoom, streamRef.current);
  }, [zoom]);

  function applyCameraZoom(nextZoom, stream = streamRef.current) {
    const track = stream?.getVideoTracks?.()[0];
    const capabilities = track?.getCapabilities?.();
    if (!track || !capabilities?.zoom) return;
    const min = capabilities.zoom.min ?? 1;
    const max = capabilities.zoom.max ?? 5;
    const value = Math.min(max, Math.max(min, nextZoom));
    track.applyConstraints({ advanced: [{ zoom: value }] }).catch(() => {});
  }

  function setSafeZoom(nextZoom) {
    setZoom(Math.min(5, Math.max(0.5, Number(nextZoom.toFixed(2)))));
  }

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      setCameraError("Kamera henüz hazır değil.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      setCapturedMoment({ blob, dataUrl: canvas.toDataURL("image/png") });
      setMode("preview");
    }, "image/png", 0.98);
  }

  function save() {
    if (!capturedMoment?.dataUrl) return;
    const link = document.createElement("a");
    link.href = capturedMoment.dataUrl;
    link.download = "moment.png";
    link.click();
  }

  if (mode === "preview" && capturedMoment) {
    return (
      <section className="moment-compose">
        <img src={capturedMoment.dataUrl} alt="Moment önizleme" />
        <div className="compose-left">
          <button onClick={save}>İndir</button>
          <button onClick={() => { setCapturedMoment(null); setMode("capture"); }}>Sil</button>
        </div>
        <button className="compose-send" onClick={() => setMode("send")}>Gönder</button>
      </section>
    );
  }

  if (mode === "send" && capturedMoment) {
    return (
      <section className="send-screen">
        <div className="send-tools">
          <button>＋ Grup Kur</button>
          <button>⚡ Kısa Yol</button>
        </div>
        <div className="stack">
          {friends.map((friend) => (
            <button className={`person-card as-button ${selectedReceivers.includes(friend.id) ? "selected-card" : ""}`} key={friend.id} onClick={() => setSelectedReceivers(toggleId(selectedReceivers, friend.id))}>
              <Avatar person={friend} />
              <PersonText person={friend} />
            </button>
          ))}
          {!friends.length && <Empty text="Moment göndermek için önce arkadaş ekle." />}
        </div>
        <div className="send-footer">
          <button className="small-action muted" onClick={() => setMode("preview")}>Geri</button>
          <button className="small-action" onClick={() => blockedIds.length && !hideMomentWarning ? setShowWarning(true) : onSend(selectedReceivers)}>Gönder</button>
        </div>
        {showWarning && (
          <div className="full-panel warning-panel">
            <button className="close-button" onClick={() => setShowWarning(false)}>X</button>
            <h2>Momentleri Açılmamış Kişiler</h2>
            <p>Devam edersen bu kişilere Moment gönderilemez.</p>
            <div className="stack">{blockedFriends.map((friend) => <article className="person-card" key={friend.id}><Avatar person={friend} /><PersonText person={friend} /></article>)}</div>
            <label className="checkbox-line"><input type="checkbox" checked={hideMomentWarning} onChange={(event) => setHideMomentWarning(event.target.checked)} /> Bu uyarıyı tekrar gösterme</label>
            <div className="send-footer">
              <button className="small-action muted" onClick={() => setShowWarning(false)}>Geri</button>
              <button className="small-action" onClick={() => { setShowWarning(false); onSend(selectedReceivers); }}>Devam Et</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="camera-full" onDoubleClick={() => setFacingMode(facingMode === "environment" ? "user" : "environment")} onClick={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setFocus({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      setTimeout(() => setFocus(null), 700);
    }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ transform: `scale(${Math.max(1, zoom)})` }} />
      {cameraError && <div className="camera-fallback">{cameraError}</div>}
      {focus && <span className="focus-ring" style={{ left: focus.x, top: focus.y }} />}
      <button className="flip-camera" onClick={(event) => { event.stopPropagation(); setFacingMode(facingMode === "environment" ? "user" : "environment"); }}>⇄</button>
      <div className="zoom-row">{lenses.map((lens) => <button key={lens} className={Math.abs(zoom - lens) < 0.05 ? "active" : ""} onClick={(event) => { event.stopPropagation(); setSafeZoom(lens); }}>{lens}x</button>)}</div>
      <button
        className="shutter"
        onPointerDown={(event) => {
          event.stopPropagation();
          shutterDragRef.current = { y: event.clientY, zoom, moved: false };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!shutterDragRef.current) return;
          event.stopPropagation();
          const delta = (shutterDragRef.current.y - event.clientY) / 90;
          if (Math.abs(delta) > 0.05) shutterDragRef.current.moved = true;
          setSafeZoom(shutterDragRef.current.zoom + delta);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          const state = shutterDragRef.current;
          shutterDragRef.current = null;
          if (!state?.moved) capture();
        }}
      />
    </section>
  );
}

function MomentViewer({ moment, onClose }) {
  return (
    <div className="moment-overlay">
      <div className="moment-viewer">
        <img src={moment.signedUrl} alt="Gelen Moment" />
        <button onClick={onClose}>Sohbete dön</button>
      </div>
    </div>
  );
}

function DiscoverScreen({ people, onProfile }) {
  const ranked = [...people].sort((a, b) => score(b) - score(a));
  return (
    <section className="stack">
      {ranked.length ? ranked.map((person, index) => (
        <button className="discover-card as-button" key={person.id} onClick={() => onProfile(person)}>
          <span className="rank">{index + 1}</span>
          <Avatar person={person} />
          <PersonText person={person} />
          <div className="score-badge"><strong>{score(person)}</strong><span>Toplam puan</span></div>
          <div className="stat-strip">
            <span>{person.total_moments_sent || 0}<small>Atılan Moment</small></span>
            <span>{person.total_moments_opened || 0}<small>Açılan Moment</small></span>
          </div>
        </button>
      )) : <Empty text="Keşfet için kullanıcı bulunamadı." />}
    </section>
  );
}

function ProfileScreen({ profile, friends, onEdit }) {
  if (!profile) return <Empty text="Profil bulunamadı." />;
  const issues = profileCompatibilityIssues(profile);
  return (
    <section className="profile">
      <Avatar person={profile} large />
      <div className="profile-title"><h2>{fullName(profile)}</h2><VerifiedBadge profile={profile} /></div>
      <p>@{profile.username}</p>
      {issues.length > 0 && (
        <article className="compat-card">
          <h3>Profil bilgilerini güncelle</h3>
          <p>Moments’te yeni kullanıcı adı ve hesap türü sistemi kullanılıyor. Profilini güncelleyerek hesabını yeni sisteme uyumlu hale getir.</p>
          <button className="small-action" onClick={onEdit}>Profili Güncelle</button>
        </article>
      )}
      {isFrozen(profile) && <p className="status-note">Profil donduruldu.</p>}
      {isDeletePending(profile) && <p className="status-note">Silme talebi beklemede.</p>}
      <div className="metric-grid">
        <Metric value={profile.friend_count || friends.length} label="arkadaş" />
        <Metric value={score(profile)} label="toplam puan" />
        <Metric value={profile.total_moments_sent || 0} label="Atılan Moment" />
        <Metric value={profile.total_moments_opened || 0} label="Açılan Moment" />
      </div>
    </section>
  );
}

function ProfileEditor({ profile, onClose, onSave, onPhotoUpload, onUsernameCheck }) {
  const fileRef = useRef(null);
  const [photoDraft, setPhotoDraft] = useState(null);
  const [photoAdjust, setPhotoAdjust] = useState({ scale: 1.2, x: 0, y: 0 });
  const [form, setForm] = useState({
    accountType: profile.account_type || "personal",
    name: profile.name || "",
    surname: profile.surname || "",
    businessName: profile.business_name || profile.name || "",
    username: normalizeUsername(profile.username || "")
  });
  const [usernameState, setUsernameState] = useState(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await onUsernameCheck(form.username);
      setUsernameState(result.available ? { ok: true, message: "Kullanıcı adı uygun." } : { ok: false, message: "Bu kullanıcı adı dolu." });
    }, 260);
    return () => clearTimeout(timer);
  }, [form.username]);

  return (
    <div className="full-panel">
      <button className="close-button" onClick={onClose}>X</button>
      <h2>Profil Düzenle</h2>
      <button className="small-action" onClick={() => fileRef.current?.click()}>Profil Fotoğrafını Değiştir</button>
      <input
        ref={fileRef}
        className="visually-hidden-file"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (photoDraft?.url) URL.revokeObjectURL(photoDraft.url);
          setPhotoDraft({ file, url: URL.createObjectURL(file) });
          setPhotoAdjust({ scale: 1.2, x: 0, y: 0 });
          event.target.value = "";
        }}
      />
      {photoDraft && (
        <section className="photo-crop-card">
          <div className="avatar-crop-preview">
            <img
              src={photoDraft.url}
              alt="Profil fotoğrafı önizleme"
              style={{ transform: `translate(${photoAdjust.x}px, ${photoAdjust.y}px) scale(${photoAdjust.scale})` }}
            />
          </div>
          <label>Yakınlaştır<input type="range" min="1" max="3" step="0.05" value={photoAdjust.scale} onChange={(event) => setPhotoAdjust({ ...photoAdjust, scale: Number(event.target.value) })} /></label>
          <label>Yatay<input type="range" min="-90" max="90" step="1" value={photoAdjust.x} onChange={(event) => setPhotoAdjust({ ...photoAdjust, x: Number(event.target.value) })} /></label>
          <label>Dikey<input type="range" min="-90" max="90" step="1" value={photoAdjust.y} onChange={(event) => setPhotoAdjust({ ...photoAdjust, y: Number(event.target.value) })} /></label>
          <div className="person-actions">
            <button className="small-action" onClick={async () => {
              await onPhotoUpload(await createCroppedAvatar(photoDraft.file, photoAdjust));
              URL.revokeObjectURL(photoDraft.url);
              setPhotoDraft(null);
            }}>Fotoğrafı Kaydet</button>
            <button className="small-action muted" onClick={() => { URL.revokeObjectURL(photoDraft.url); setPhotoDraft(null); }}>Vazgeç</button>
          </div>
        </section>
      )}
      <div className="segmented">
        <button className={form.accountType === "personal" ? "selected" : ""} onClick={() => setForm({ ...form, accountType: "personal" })}>Kişisel</button>
        <button className={form.accountType === "business" ? "selected" : ""} onClick={() => setForm({ ...form, accountType: "business" })}>Ticari</button>
      </div>
      {form.accountType === "business" ? (
        <Field label="İşletme Adı" note="Ad değişikliği 30 günde bir yapılabilir."><input value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} /></Field>
      ) : (
        <>
          <Field label="Ad Değiştir" note="Ad değişikliği 30 günde bir yapılabilir."><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Soyad" note="Kişisel hesap soyadı."><input value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} /></Field>
        </>
      )}
      <Field label="Kullanıcı Adı" note="Kullanıcı adı 14 günde bir değiştirilebilir.">
        <div className="username-field"><span>@</span><input value={form.username} onChange={(event) => setForm({ ...form, username: normalizeUsername(event.target.value) })} /></div>
        {usernameState && <small className={usernameState.ok ? "field-ok" : "field-error"}>{usernameState.message}</small>}
      </Field>
      <Field label="Hesap Türü" note="Kişisel ⇄ Ticari geçişi 30 günde bir yapılabilir." />
      <button className="small-action" onClick={() => onSave(form)}>Kaydet</button>
    </div>
  );
}

async function createCroppedAvatar(file, adjust) {
  const image = await loadImage(URL.createObjectURL(file));
  const size = 720;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#EEE9C8";
  ctx.fillRect(0, 0, size, size);

  const base = Math.max(size / image.naturalWidth, size / image.naturalHeight) * adjust.scale;
  const width = image.naturalWidth * base;
  const height = image.naturalHeight * base;
  const x = (size - width) / 2 + adjust.x * 3;
  const y = (size - height) / 2 + adjust.y * 3;

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  return new File([blob], "profile-photo.jpg", { type: "image/jpeg" });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function SettingsScreen({ profile, theme, setTheme, onRules, onFreeze, onUnfreeze, onDelete, onCancelDelete, onSignOut }) {
  return (
    <section className="stack">
      <article className="settings-row">
        <div><strong>Tema</strong><small>{theme === "dark" ? "Dark" : "Light"}</small></div>
        <div className="segmented">
          <button className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}>Light</button>
          <button className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}>Dark</button>
        </div>
      </article>
      <button className="settings-link" onClick={onRules}>Uygulama Kuralları</button>
      <section className="status-card">
        <h3>Hesap Durumu</h3>
        <p>Profili dondurmak arama, keşfet, mesaj ve Moment akışını geçici olarak kapatır.</p>
        {isFrozen(profile) ? <button className="small-action" onClick={onUnfreeze}>Profili Geri Aç</button> : <button className="small-action muted" onClick={onFreeze}>Profili Dondur</button>}
        {isDeletePending(profile) ? <button className="small-action" onClick={onCancelDelete}>Silme Talebinden Vazgeç</button> : <button className="small-action muted" onClick={onDelete}>Profili Sil</button>}
      </section>
      <button className="small-action" onClick={onSignOut}>Çıkış yap</button>
    </section>
  );
}

function RulesScreen({ onClose }) {
  const sections = [
    ["Moment sistemi", "Momentler arkadaşlar arasında paylaşılır. Gelen Moment açıldıktan sonra ekrandan çıkınca açılmış sayılır."],
    ["Mesaj sistemi", "Okundu, görüldü ve yazıyor göstergesi kullanılmaz. Mesajlar çift dokunma menüsüyle yönetilir."],
    ["Arkadaş sistemi", "Mesaj ve Moment yalnızca arkadaşlar arasında gönderilebilir."],
    ["Gizlilik", "Dondurulan profiller arama, keşfet, mesaj ve Moment akışlarında görünmez."],
    ["Screenshot sistemi", "Screenshot bildirimi altyapısı uygulama davranışlarına göre genişletilebilir."],
    ["Topluluk kuralları", "Güvenli, saygılı ve gerçek kişiler arası iletişim esastır."]
  ];
  return (
    <div className="full-panel rules-page">
      <button className="close-button" onClick={onClose}>X</button>
      <h2>Uygulama Kuralları</h2>
      {sections.map(([title, text]) => <article className="rule-card" key={title}><h3>{title}</h3><p>{text}</p></article>)}
    </div>
  );
}

function ProfileModal({ person, isFriend, onClose, onRequest, onChat }) {
  return (
    <div className="full-panel profile-modal">
      <button className="close-button" onClick={onClose}>X</button>
      <Avatar person={person} large />
      <div className="profile-title"><h2>{fullName(person)}</h2><VerifiedBadge profile={person} /></div>
      <p>@{person.username}</p>
      <div className="metric-grid">
        <Metric value={person.friend_count || 0} label="arkadaş" />
        <Metric value={score(person)} label="toplam puan" />
      </div>
      {isFriend ? <button className="small-action" onClick={() => onChat(person)}>Mesaj Gönder</button> : <button className="small-action" onClick={() => onRequest(person.id)}>Arkadaş Ekle</button>}
    </div>
  );
}

function Field({ label, note, children }) {
  return <label className="form-group"><span>{label}</span>{children}<small>{note}</small></label>;
}

function Avatar({ person, large = false }) {
  if (person?.profile_photo_url) return <img className={large ? "avatar large" : "avatar"} src={person.profile_photo_url} alt="" />;
  return <div className={large ? "avatar large" : "avatar"}>{initials(person)}</div>;
}

function VerifiedBadge({ profile }) {
  const label = verificationLabel(profile);
  if (!label) return null;
  return <button type="button" className="verified-badge" title={label} aria-label={label} onClick={() => alert(label)}><span /></button>;
}

function PersonText({ person, compact = false }) {
  return (
    <div className="person-main">
      <strong><span>{fullName(person)}</span><VerifiedBadge profile={person} /></strong>
      {!compact && <small>@{person?.username || ""}</small>}
    </div>
  );
}

function Empty({ text }) {
  return <p className="empty-state">{text}</p>;
}

function Metric({ value, label }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}

function chatForFriend(chats, userId, friendId) {
  return chats.find((chat) => (chat.member_a === userId && chat.member_b === friendId) || (chat.member_b === userId && chat.member_a === friendId));
}

function toggleId(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}
