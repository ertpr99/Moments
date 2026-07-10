import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  cancelFriendRequest,
  deleteMessageForEveryone,
  displayName,
  getSession,
  initials,
  loadChats,
  loadDiscover,
  loadFriends,
  loadIncomingMoments,
  loadProfile,
  loadRequests,
  markMomentOpened,
  respondFriendRequest,
  score,
  searchUsers,
  sendFriendRequest,
  sendMessage,
  sendMoment,
  signedMomentUrl,
  signIn,
  signOut,
  signUp,
  validateUsername
} from "./lib/api.js";
import { hasSupabaseConfig, supabase } from "./lib/supabase.js";
import { t } from "./lib/translations.js";
import "./styles.css";

const tabs = [
  ["friends", t.friends, "A"],
  ["camera", t.camera, "K"],
  ["chat", t.chat, "S"],
  ["discover", t.discover, "D"],
  ["profile", t.profile, "P"],
  ["settings", t.settings, "T"]
];

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState("friends");
  const [authMode, setAuthMode] = useState("signin");
  const [theme, setTheme] = useState(() => localStorage.getItem("moments-theme") || "light");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [readIds, setReadIds] = useState(() => JSON.parse(localStorage.getItem("moments-read-ids") || "[]"));
  const [moments, setMoments] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [momentQueue, setMomentQueue] = useState([]);
  const [momentIndex, setMomentIndex] = useState(0);
  const [captured, setCaptured] = useState(null);
  const [selectedReceiver, setSelectedReceiver] = useState("");
  const [messageMenu, setMessageMenu] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const activeFriend = friends.find((friend) => friend.id === activeChatId);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("moments-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    getSession().then(async (next) => {
      setSession(next);
      if (next?.user) await refreshAll(next.user.id, next.user);
    });
    const { data } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next?.user) await refreshAll(next.user.id, next.user);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const channel = supabase
      .channel("moments-app")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refreshChats())
      .on("postgres_changes", { event: "*", schema: "public", table: "moments" }, () => refreshMoments())
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => refreshRequests())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  async function run(action, success) {
    try {
      setError("");
      setNotice("");
      await action();
      if (success) setNotice(success);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshAll(userId = session?.user?.id, user = session?.user) {
    if (!userId || !user) return;
    const [nextProfile, nextFriends, nextRequests, nextChats, nextMoments, nextDiscover] = await Promise.all([
      loadProfile(user),
      loadFriends(userId).catch(() => []),
      loadRequests(userId).catch(() => ({ incoming: [], outgoing: [] })),
      loadChats(userId).catch(() => ({ chats: [], messages: [] })),
      loadIncomingMoments(userId).catch(() => []),
      loadDiscover().catch(() => [])
    ]);
    setProfile(nextProfile);
    setFriends(nextFriends);
    setRequests(nextRequests);
    setChats(nextChats.chats);
    setMessages(nextChats.messages);
    setMoments(nextMoments);
    setDiscover(nextDiscover);
  }

  async function refreshRequests() {
    if (session?.user) setRequests(await loadRequests(session.user.id));
  }

  async function refreshChats() {
    if (!session?.user) return;
    const next = await loadChats(session.user.id);
    setChats(next.chats);
    setMessages(next.messages);
  }

  async function refreshMoments() {
    if (session?.user) setMoments(await loadIncomingMoments(session.user.id));
  }

  function unreadMessageCount(friendId) {
    const chat = chatForFriend(chats, session?.user?.id, friendId);
    if (!chat) return 0;
    return messages.filter((message) => message.chat_id === chat.id && message.sender_id !== session.user.id && !readIds.includes(message.id)).length;
  }

  const chatBadge = friends.reduce((sum, friend) => sum + unreadMessageCount(friend.id), 0) + moments.filter((moment) => (moment.open_count || 0) === 0).length;

  async function openChat(friendId) {
    setActiveChatId(friendId);
    const queue = moments.filter((moment) => moment.sender_id === friendId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (queue.length) {
      const hydrated = await Promise.all(queue.map(async (moment) => ({ ...moment, signedUrl: await signedMomentUrl(moment) })));
      setMomentQueue(hydrated);
      setMomentIndex(0);
      return;
    }
    markMessagesRead(friendId);
  }

  function markMessagesRead(friendId) {
    const chat = chatForFriend(chats, session?.user?.id, friendId);
    if (!chat) return;
    const next = new Set(readIds);
    messages.filter((message) => message.chat_id === chat.id && message.sender_id !== session.user.id).forEach((message) => next.add(message.id));
    const list = [...next];
    setReadIds(list);
    localStorage.setItem("moments-read-ids", JSON.stringify(list));
  }

  async function advanceMoment() {
    const current = momentQueue[momentIndex];
    if (current) await markMomentOpened(current, session.user.id);
    if (momentIndex + 1 < momentQueue.length) {
      setMomentIndex(momentIndex + 1);
      return;
    }
    setMomentQueue([]);
    setMomentIndex(0);
    markMessagesRead(activeChatId);
    await refreshAll();
  }

  if (!hasSupabaseConfig) return <Shell theme={theme}><Empty title="Supabase bağlantısı eksik" text="Vercel Environment Variables içine SUPABASE_URL, SUPABASE_ANON_KEY ve STORAGE_BUCKET_NAME ekle." /></Shell>;
  if (!session) return <Auth authMode={authMode} setAuthMode={setAuthMode} run={run} />;

  return (
    <Shell theme={theme} title={activeChatId ? displayName(activeFriend) : tabs.find(([id]) => id === screen)?.[1]} hideChrome={momentQueue.length > 0}>
      {screen === "friends" && <Friends friends={friends} requests={requests} search={search} setSearch={setSearch} results={results} onSearch={(value) => run(async () => setResults(await searchUsers(session.user.id, value, friends.map((f) => f.id))))} onRequest={(id) => run(async () => { const request = await sendFriendRequest(session.user.id, id); setRequests((current) => ({ ...current, outgoing: [...current.outgoing.filter((item) => item.receiver_id !== id), request] })); await refreshRequests(); })} onCancel={(id) => run(async () => { await cancelFriendRequest(id); await refreshRequests(); })} onRespond={(request, accepted) => run(async () => { await respondFriendRequest(request, accepted); await refreshAll(); })} />}
      {screen === "camera" && <Camera friends={friends} selectedReceiver={selectedReceiver} setSelectedReceiver={setSelectedReceiver} captured={captured} setCaptured={setCaptured} onSend={() => run(async () => { if (!selectedReceiver || !captured?.blob) throw new Error("Moment göndermek için arkadaş seç."); const blocked = moments.some((moment) => moment.sender_id === selectedReceiver && (moment.open_count || 0) === 0); if (blocked) throw new Error("Önce bu arkadaşından gelen Moment'i açmalısın."); await sendMoment(session.user.id, selectedReceiver, captured.blob); setCaptured(null); setScreen("chat"); await refreshMoments(); }, "Moment gönderildi.")} />}
      {screen === "chat" && !activeChatId && <ChatList friends={friends} chats={chats} messages={messages} moments={moments} unreadMessageCount={unreadMessageCount} onOpen={(id) => run(async () => openChat(id))} />}
      {screen === "chat" && activeChatId && !momentQueue.length && <ChatDetail userId={session.user.id} friend={activeFriend} chat={chatForFriend(chats, session.user.id, activeChatId)} messages={messages} menu={messageMenu} setMenu={setMessageMenu} onBack={() => setActiveChatId("")} onSend={(body) => run(async () => { await sendMessage(session.user.id, activeChatId, body); await refreshChats(); })} onDelete={(id) => run(async () => { await deleteMessageForEveryone(id); await refreshChats(); })} />}
      {screen === "discover" && <Discover people={discover} />}
      {screen === "profile" && <Profile profile={profile} friends={friends} />}
      {screen === "settings" && <Settings theme={theme} setTheme={setTheme} onSignOut={() => run(signOut)} />}
      {momentQueue.length > 0 && <MomentViewer moment={momentQueue[momentIndex]} index={momentIndex} total={momentQueue.length} onAdvance={() => run(advanceMoment)} />}
      {notice && <div className="toast">{notice}</div>}
      {error && <div className="toast error">{error}</div>}
      <nav className="bottom-nav">
        {tabs.map(([id, label, icon]) => {
          const badge = id === "friends" ? requests.incoming.length : id === "chat" ? chatBadge : 0;
          return <button key={id} className={screen === id ? "active" : ""} onClick={() => { setScreen(id); if (id !== "chat") setActiveChatId(""); }}><span>{icon}{badge > 0 && <em>+{badge}</em>}</span><small>{label}</small></button>;
        })}
      </nav>
    </Shell>
  );
}

function Shell({ children, title = "Moments", theme, hideChrome = false }) {
  return <main className="app" data-theme={theme}>{!hideChrome && <header><p>Moments</p><h1>{title}</h1></header>}<section className={hideChrome ? "content full" : "content"}>{children}</section></main>;
}

function Auth({ authMode, setAuthMode, run }) {
  const [form, setForm] = useState({ accountType: "personal", name: "", surname: "", businessName: "", username: "", email: "", password: "" });
  const signup = authMode === "signup";
  const usernameError = signup ? validateUsername(form.username) : "";
  return <Shell theme="light"><section className="auth"><h1>{t.welcome}</h1><div className="segmented"><button className={!signup ? "selected" : ""} onClick={() => setAuthMode("signin")}>Giriş</button><button className={signup ? "selected" : ""} onClick={() => setAuthMode("signup")}>Kayıt</button></div><form onSubmit={(e) => { e.preventDefault(); run(() => signup ? signUp(form) : signIn(form.email, form.password)); }}>{signup && <><div className="segmented"><button type="button" className={form.accountType === "personal" ? "selected" : ""} onClick={() => setForm({ ...form, accountType: "personal" })}>Kişisel</button><button type="button" className={form.accountType === "business" ? "selected" : ""} onClick={() => setForm({ ...form, accountType: "business" })}>Ticari</button></div>{form.accountType === "business" ? <input placeholder="İşletme adı" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required /> : <><input placeholder="Ad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input placeholder="Soyad" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} required /></>}<label><span>@</span><input placeholder="kullanici_adi" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>{usernameError && <small className="field-error">{usernameError}</small>}</>}<input type="email" placeholder="E-posta" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /><input type="password" placeholder="Şifre" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /><button>{signup ? "Kayıt Ol" : "Giriş Yap"}</button></form></section></Shell>;
}

function Friends({ friends, requests, search, setSearch, results, onSearch, onRequest, onCancel, onRespond }) {
  return <section className="stack"><label className="search"><span>Kullanıcı ara</span><input value={search} onChange={(e) => { setSearch(e.target.value); onSearch(e.target.value); }} /></label>{search && <div className="stack">{results.map((person) => <Person key={person.id} person={person} action={<RequestAction person={person} outgoing={requests.outgoing} onRequest={onRequest} onCancel={onCancel} />} />)}{!results.length && <Empty text="Kullanıcı bulunamadı." />}</div>}<Accordion title="Arkadaş İstekleri" count={requests.incoming.length}>{requests.incoming.map((request) => <Person key={request.id} person={request.sender} action={<><button onClick={() => onRespond(request, true)}>Kabul</button><button className="muted" onClick={() => onRespond(request, false)}>Reddet</button></>} />)}{!requests.incoming.length && <Empty text={t.emptyRequests} />}</Accordion><Accordion title={friends.length ? "Arkadaşlar" : t.emptyFriends} count={friends.length}>{friends.map((friend) => <Person key={friend.id} person={friend} />)}{!friends.length && <Empty text={t.emptyFriends} />}</Accordion></section>;
}

function RequestAction({ person, outgoing, onRequest, onCancel }) {
  const pending = outgoing.find((request) => request.receiver_id === person.id);
  return pending ? <div className="inline-actions"><small>Arkadaşlık gönderildi</small><button className="muted" onClick={() => onCancel(pending.id)}>İsteği iptal et</button></div> : <button onClick={() => onRequest(person.id)}>Arkadaş ekle</button>;
}

function Accordion({ title, count, children }) {
  const [open, setOpen] = useState(true);
  return <section className="panel"><button className="accordion" onClick={() => setOpen(!open)}><strong>{title}</strong><span>{count}</span></button>{open && <div className="stack">{children}</div>}</section>;
}

function Camera({ friends, selectedReceiver, setSelectedReceiver, captured, setCaptured, onSend }) {
  const videoRef = useRef(null);
  useEffect(() => { navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment", width: { ideal: 4096 }, height: { ideal: 2160 } }, audio: true }).then((stream) => { if (videoRef.current) videoRef.current.srcObject = stream; }).catch(() => {}); }, []);
  async function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth) throw new Error("Kamera izni gerekli.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => setCaptured({ blob, url: URL.createObjectURL(blob), kind: "photo" }), "image/png");
  }
  if (captured) return <section className="camera preview"><img src={captured.url} alt="Moment" /><div className="camera-actions"><button onClick={() => { const link = document.createElement("a"); link.href = captured.url; link.download = "moment.png"; link.click(); }}>İndir</button><button className="muted" onClick={() => setCaptured(null)}>Sil</button><button onClick={onSend}>Gönder</button></div><select value={selectedReceiver} onChange={(e) => setSelectedReceiver(e.target.value)}><option value="">Arkadaş seç</option>{friends.map((friend) => <option key={friend.id} value={friend.id}>{displayName(friend)}</option>)}</select></section>;
  return <section className="camera"><video ref={videoRef} autoPlay playsInline muted /><button className="shutter" onClick={() => capture().catch(() => {})} /></section>;
}

function ChatList({ friends, chats, messages, moments, unreadMessageCount, onOpen }) {
  return <section className="stack">{friends.map((friend) => { const chat = chatForFriend(chats, null, friend.id); const hasMessage = unreadMessageCount(friend.id) > 0; const hasMoment = moments.some((moment) => moment.sender_id === friend.id && (moment.open_count || 0) === 0); return <button className="chat-row" key={friend.id} onClick={() => onOpen(friend.id)}><Avatar person={friend} /><strong>{displayName(friend)}</strong><span className="dots">{hasMoment && <i className="green" />}{hasMessage && <i className="red" />}</span></button>; })}{!friends.length && <Empty text={t.emptyChats} />}</section>;
}

function ChatDetail({ userId, friend, chat, messages, menu, setMenu, onBack, onSend, onDelete }) {
  const [body, setBody] = useState("");
  const visible = chat ? messages.filter((message) => message.chat_id === chat.id) : [];
  return <section className="chat-detail"><button className="back" onClick={onBack}>Geri</button><Person person={friend} /> <div className="messages">{visible.map((message) => <article key={message.id} className={`bubble ${message.sender_id === userId ? "mine" : ""}`} onDoubleClick={() => setMenu(menu === message.id ? "" : message.id)}><small>{new Date(message.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</small><p>{message.body}</p>{menu === message.id && <div className="inline-actions"><button onClick={() => onDelete(message.id)}>Herkesten sil</button><button className="muted">Kendim için sil</button></div>}</article>)}{!visible.length && <Empty text="Henüz mesaj yok." />}</div><form onSubmit={(e) => { e.preventDefault(); onSend(body); setBody(""); }}><input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mesaj yaz" /><button>Gönder</button></form></section>;
}

function MomentViewer({ moment, index, total, onAdvance }) {
  const video = moment.storage_path?.endsWith(".webm");
  return <section className="moment-viewer" onClick={onAdvance}>{video ? <video src={moment.signedUrl} autoPlay playsInline controls /> : <img src={moment.signedUrl} alt="Moment" />}<div className="progress">{Array.from({ length: total }).map((_, i) => <span key={i} className={i <= index ? "active" : ""} />)}</div></section>;
}

function Discover({ people }) {
  return <section className="stack">{[...people].sort((a, b) => score(b) - score(a)).map((person, index) => <article className="discover" key={person.id}><b>#{index + 1}</b><Avatar person={person} /><div><strong>{displayName(person)}</strong><small>@{person.username}</small></div><span>{score(person)} puan</span></article>)}{!people.length && <Empty text={t.emptyDiscover} />}</section>;
}

function Profile({ profile, friends }) {
  return <section className="profile"><Avatar person={profile} large /><h2>{displayName(profile)}</h2><p>@{profile?.username}</p><div className="metrics"><span>{friends.length}<small>Arkadaş</small></span><span>{score(profile)}<small>Puan</small></span><span>{profile?.total_moments_sent || 0}<small>Atılan Moment</small></span><span>{profile?.total_moments_opened || 0}<small>Açılan Moment</small></span></div></section>;
}

function Settings({ theme, setTheme, onSignOut }) {
  return <section className="stack"><div className="panel"><strong>Tema</strong><div className="segmented"><button className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}>Gündüz</button><button className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}>Gece</button></div></div><button onClick={onSignOut}>Çıkış yap</button></section>;
}

function Person({ person, action }) {
  return <article className="person"><Avatar person={person} /><div><strong>{displayName(person)}</strong><small>@{person?.username || ""}</small></div>{action}</article>;
}

function Avatar({ person, large = false }) {
  return person?.profile_photo_url ? <img className={large ? "avatar large" : "avatar"} src={person.profile_photo_url} alt="" /> : <span className={large ? "avatar large" : "avatar"}>{initials(person)}</span>;
}

function Empty({ title, text }) {
  return <div className="empty">{title && <h2>{title}</h2>}<p>{text}</p></div>;
}

function chatForFriend(chats, userId, friendId) {
  return chats.find((chat) => chat.member_a === friendId || chat.member_b === friendId || (userId && ((chat.member_a === userId && chat.member_b === friendId) || (chat.member_b === userId && chat.member_a === friendId))));
}

createRoot(document.getElementById("root")).render(<App />);
