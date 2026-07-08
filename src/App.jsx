import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteMessageForEveryone,
  deleteMessageForSelf,
  fullName,
  getProfile,
  getSession,
  initials,
  loadChats,
  loadDiscover,
  loadFriends,
  loadIncomingMoments,
  loadRequests,
  markMomentOpened,
  openMoment,
  respondFriendRequest,
  score,
  searchUsers,
  sendFriendRequest,
  sendMessage,
  sendMoment,
  signIn,
  signOut,
  signUp
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
  const [selectedMomentReceiver, setSelectedMomentReceiver] = useState("");
  const [messageMenuId, setMessageMenuId] = useState("");

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
    const [nextProfile, nextFriends, nextRequests, nextChats, nextMoments, nextDiscover] = await Promise.all([
      getProfile(user),
      loadFriends(user.id),
      loadRequests(user.id),
      loadChats(user.id),
      loadIncomingMoments(user.id),
      loadDiscover()
    ]);
    setProfile(nextProfile);
    setFriends(nextFriends);
    setRequests(nextRequests);
    setChats(nextChats.chats);
    setMessages(nextChats.messages);
    setIncomingMoments(nextMoments);
    setDiscover(nextDiscover);
  }

  async function refreshRequests(userId = session?.user?.id) {
    if (!userId) return;
    setRequests(await loadRequests(userId));
  }

  async function refreshChats(userId = session?.user?.id) {
    if (!userId) return;
    const next = await loadChats(userId);
    setChats(next.chats);
    setMessages(next.messages);
  }

  async function refreshMoments(userId = session?.user?.id) {
    if (!userId) return;
    setIncomingMoments(await loadIncomingMoments(userId));
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

  if (loading) return <Shell theme={theme} setTheme={setTheme}><CenterState title="Moments" text="Hazırlanıyor..." /></Shell>;
  if (!hasSupabaseConfig) {
    return <Shell theme={theme} setTheme={setTheme}><CenterState title="Supabase gerekli" text="SUPABASE_URL ve SUPABASE_ANON_KEY Vercel Environment Variables içinde tanımlanmalı." /></Shell>;
  }
  if (!session) {
    return (
      <Shell theme={theme} setTheme={setTheme}>
        <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={(form) => run(async () => {
          const nextSession = authMode === "signin" ? await signIn(form.email, form.password) : await signUp(form);
          setSession(nextSession);
          await refreshAll(nextSession.user);
        })} error={error} />
      </Shell>
    );
  }

  const activeFriend = friends.find((friend) => friend.id === activeChatId);

  return (
    <Shell theme={theme} setTheme={setTheme} notice={notice} title={activeFriend && screen === "chat" ? fullName(activeFriend) : tabs.find((tab) => tab.id === screen)?.label || "Moments"}>
      {screen === "friends" && (
        <FriendsScreen
          friends={friends}
          requests={requests}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          onSearch={(query) => run(async () => setSearchResults(await searchUsers(session.user.id, query, friends.map((friend) => friend.id))))}
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
          receiverId={selectedMomentReceiver}
          setReceiverId={setSelectedMomentReceiver}
          capturedMoment={capturedMoment}
          setCapturedMoment={setCapturedMoment}
          blockedByIncoming={incomingMoments.some((moment) => moment.sender_id === selectedMomentReceiver)}
          onSend={() => run(async () => {
            if (!selectedMomentReceiver) throw new Error("Moment göndermek için arkadaş seç.");
            if (!capturedMoment?.blob) throw new Error("Önce kamera ile Moment çek.");
            if (incomingMoments.some((moment) => moment.sender_id === selectedMomentReceiver)) {
              throw new Error("Önce bu arkadaşından gelen Moment'i açmalısın.");
            }
            await sendMoment(session.user.id, selectedMomentReceiver, capturedMoment.blob);
            setCapturedMoment(null);
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

      {screen === "discover" && <DiscoverScreen people={discover} />}
      {screen === "profile" && <ProfileScreen profile={profile} friends={friends} />}
      {screen === "settings" && <SettingsScreen theme={theme} setTheme={setTheme} onSignOut={() => run(signOut)} />}

      {error && <div className="toast">{error}</div>}
      <nav className="bottom-nav">
        {tabs.map((tab) => (
          <button key={tab.id} className={screen === tab.id ? "active" : ""} onClick={() => {
            setScreen(tab.id);
            if (tab.id !== "chat") setActiveChatId("");
          }}>
            <span>{tab.icon}</span>
            <small>{tab.label}</small>
          </button>
        ))}
      </nav>
    </Shell>
  );
}

function Shell({ children, notice, title = "Moments", theme, setTheme }) {
  return (
    <main className="app-shell">
      <section className="phone-app">
        <header className="top-bar">
          <div>
            <p>Moments</p>
            <h1>{title}</h1>
          </div>
          <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "L" : "D"}</button>
        </header>
        <div className="screen">{children}</div>
        {notice && <div className="toast">{notice}</div>}
      </section>
    </main>
  );
}

function CenterState({ title, text }) {
  return <section className="center-state"><h2>{title}</h2><p>{text}</p></section>;
}

function AuthScreen({ mode, setMode, onSubmit, error }) {
  const signup = mode === "signup";
  const [form, setForm] = useState({ name: "", surname: "", username: "", email: "", password: "", profilePhoto: null });
  return (
    <section className="auth-screen">
      <h2>Moments</h2>
      <p>Paylaşıma hazır beta hesabınla devam et.</p>
      <div className="segmented">
        <button className={!signup ? "selected" : ""} onClick={() => setMode("signin")}>Giriş</button>
        <button className={signup ? "selected" : ""} onClick={() => setMode("signup")}>Kayıt</button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="form">
        {signup && (
          <>
            <input placeholder="Ad" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <input placeholder="Soyad" value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} required />
            <input placeholder="@username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
            <input type="file" accept="image/*" onChange={(event) => setForm({ ...form, profilePhoto: event.target.files?.[0] || null })} />
          </>
        )}
        <input type="email" placeholder="E-posta" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input type="password" placeholder="Şifre" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        <button>{signup ? "Kayıt ol" : "Giriş yap"}</button>
      </form>
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}

function FriendsScreen({ friends, requests, searchQuery, setSearchQuery, searchResults, onSearch, onRequest, onRespond }) {
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
        <>
          <SectionHead title="Arama sonuçları" count={searchResults.length} />
          {searchResults.length ? searchResults.map((person) => (
            <article className="person-card" key={person.id}>
              <Avatar person={person} />
              <PersonText person={person} />
              <button className="small-action" onClick={() => onRequest(person.id)}>İstek gönder</button>
            </article>
          )) : <Empty text="Kullanıcı bulunamadı." />}
        </>
      )}
      <SectionHead title="Arkadaş istekleri" count={requests.incoming.length} />
      {requests.incoming.length ? requests.incoming.map((request) => (
        <article className="person-card" key={request.id}>
          <Avatar person={request.sender} />
          <PersonText person={request.sender} />
          <div className="person-actions">
            <button className="small-action" onClick={() => onRespond(request, true)}>Kabul et</button>
            <button className="small-action muted" onClick={() => onRespond(request, false)}>Reddet</button>
          </div>
        </article>
      )) : <Empty text="Henüz gelen istek yok." />}
      <SectionHead title="Arkadaşlar" count={friends.length} />
      {friends.length ? friends.map((friend) => (
        <article className="person-card" key={friend.id}>
          <Avatar person={friend} />
          <PersonText person={friend} />
        </article>
      )) : <Empty text="Henüz arkadaşın yok." />}
    </section>
  );
}

function ChatList({ friends, chats, messages, incomingMoments, userId, onOpen }) {
  return (
    <section className="stack">
      {friends.length ? friends.map((friend) => {
        const chat = chatForFriend(chats, userId, friend.id);
        const hasMessage = chat ? messages.some((message) => message.chat_id === chat.id) : false;
        const hasMoment = incomingMoments.some((moment) => moment.sender_id === friend.id);
        return (
          <button className="chat-row" key={friend.id} onClick={() => onOpen(friend.id)}>
            <Avatar person={friend} />
            <strong>{fullName(friend)}</strong>
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
      <div className="chat-person">
        <Avatar person={friend} />
        <strong>{friend ? fullName(friend) : "Sohbet"}</strong>
      </div>
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

function CameraScreen({ friends, receiverId, setReceiverId, capturedMoment, setCapturedMoment, blockedByIncoming, onSend }) {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let stream;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setCameraError("Kamera izni gerekli.");
      }
    }
    start();
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, []);

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
    }, "image/png");
  }

  function save() {
    if (!capturedMoment?.dataUrl) return;
    const link = document.createElement("a");
    link.href = capturedMoment.dataUrl;
    link.download = "moment.png";
    link.click();
  }

  return (
    <section className="camera-screen">
      <label className="search-box">
        <span>Moment alıcısı</span>
        <select value={receiverId} onChange={(event) => setReceiverId(event.target.value)}>
          <option value="">Arkadaş seç</option>
          {friends.map((friend) => <option key={friend.id} value={friend.id}>{fullName(friend)}</option>)}
        </select>
      </label>
      {blockedByIncoming && <Empty text="Önce bu arkadaşından gelen Moment'i açmalısın." />}
      <div className="camera-preview">
        {capturedMoment ? <img src={capturedMoment.dataUrl} alt="Moment önizleme" /> : <video ref={videoRef} autoPlay playsInline muted />}
        {cameraError && <div className="camera-fallback">{cameraError}</div>}
      </div>
      <div className="preview-actions">
        <button onClick={capture}>Çek</button>
        <button onClick={save} disabled={!capturedMoment}>Kaydet</button>
        <button onClick={onSend} disabled={!capturedMoment || !receiverId || blockedByIncoming}>Moment gönder</button>
      </div>
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

function DiscoverScreen({ people }) {
  const ranked = [...people].sort((a, b) => score(b) - score(a));
  return (
    <section className="stack">
      {ranked.length ? ranked.map((person, index) => (
        <article className="discover-card" key={person.id}>
          <span className="rank">{index + 1}</span>
          <Avatar person={person} />
          <PersonText person={person} />
          <div className="score-badge"><strong>{score(person)}</strong><span>Toplam puan</span></div>
          <div className="stat-strip">
            <span>{person.total_moments_sent || 0}<small>Atılan Moment</small></span>
            <span>{person.total_moments_opened || 0}<small>Açılan Moment</small></span>
          </div>
        </article>
      )) : <Empty text="Keşfet için kullanıcı bulunamadı." />}
    </section>
  );
}

function ProfileScreen({ profile, friends }) {
  if (!profile) return <Empty text="Profil bulunamadı." />;
  return (
    <section className="profile">
      <Avatar person={profile} large />
      <h2>{fullName(profile)}</h2>
      <p>@{profile.username}</p>
      <div className="metric-grid">
        <Metric value={profile.friend_count || friends.length} label="arkadaş" />
        <Metric value={score(profile)} label="toplam puan" />
        <Metric value={profile.total_moments_sent || 0} label="Atılan Moment" />
        <Metric value={profile.total_moments_opened || 0} label="Açılan Moment" />
      </div>
    </section>
  );
}

function SettingsScreen({ theme, setTheme, onSignOut }) {
  return (
    <section className="stack">
      <article className="settings-row">
        <div><strong>Tema</strong><small>{theme === "dark" ? "Dark" : "Light"}</small></div>
        <div className="segmented">
          <button className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}>Light</button>
          <button className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}>Dark</button>
        </div>
      </article>
      <button className="small-action" onClick={onSignOut}>Çıkış yap</button>
      <button className="small-action muted" onClick={() => alert("Screenshot bildirimi altyapısı aktif.")}>Screenshot uyarısı test et</button>
    </section>
  );
}

function Avatar({ person, large = false }) {
  if (person?.profile_photo_url) return <img className={large ? "avatar large" : "avatar"} src={person.profile_photo_url} alt="" />;
  return <div className={large ? "avatar large" : "avatar"}>{initials(person)}</div>;
}

function PersonText({ person }) {
  return <div className="person-main"><strong>{fullName(person)}</strong><small>@{person?.username || ""}</small></div>;
}

function SectionHead({ title, count }) {
  return <div className="section-head"><h3>{title}</h3><span>{count}</span></div>;
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
