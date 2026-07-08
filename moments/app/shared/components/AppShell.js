import {
  deleteMessageForEveryone,
  deleteMessageForSelf,
  initBackend,
  openMoment,
  respondFriendRequest,
  searchUsers,
  sendFriendRequest,
  sendMessage,
  sendMoment,
  signIn,
  signOut,
  signUp
} from "../logic/api.js";
import { displayName, initialsFor, setTheme, totalScore } from "../logic/state.js";
import { tr } from "../logic/translations.js";

const screens = ["home", "camera", "chat", "profile", "settings", "discover"];

export function mountMomentsApp(root, state, onRender) {
  const dispatch = async (action) => {
    await handleAction(state, action, root);
    render();
  };

  const render = () => {
    root.dataset.theme = state.theme;
    root.innerHTML = `
      <section class="moments-app ${state.platform}">
        ${state.session ? statusBar(state) : ""}
        <main class="screen-body">${screenContent(state)}</main>
        ${state.session ? bottomNav(state) : ""}
        ${state.notice ? `<div class="toast">${state.notice}</div>` : ""}
      </section>
    `;
    bind(root, dispatch);
    restoreSearchFocus(root, state);
    onRender?.(state);
  };

  root.addEventListener("moments-rerender", render);
  initBackend(state).then(render).catch((error) => {
    state.loading = false;
    state.error = error.message;
    render();
  });
  render();
}

function statusBar(state) {
  const active = activeChatPerson(state);
  const title = state.screen === "home" ? tr.home : state.activeChatId && active ? displayName(active) : tr[state.screen] || tr.brand;
  return `
    <header class="status">
      <div>
        <p>${tr.brand}</p>
        <h2>${title}</h2>
      </div>
      <button class="icon-button" data-action="refresh" title="Yenile">R</button>
    </header>
  `;
}

function bottomNav(state) {
  return `
    <nav class="bottom-nav">
      ${screens.map((screen) => `
        <button class="${state.screen === screen ? "active" : ""}" data-screen="${screen}" title="${tr[screen]}">
          <span>${navIcon(screen)}</span>
          <small>${tr[screen]}</small>
        </button>
      `).join("")}
    </nav>
  `;
}

function navIcon(screen) {
  return { home: "H", camera: "C", chat: "M", profile: "P", settings: "S", discover: "D" }[screen];
}

function screenContent(state) {
  if (state.loading) return `<section class="center-state"><h1>${tr.brand}</h1><p>Backend baglantisi hazirlaniyor.</p></section>`;
  if (!state.configured) return setupScreen();
  if (!state.session) return authScreen(state);
  if (state.screen === "camera") return cameraScreen(state);
  if (state.screen === "preview") return previewScreen(state);
  if (state.screen === "chat") return chatScreen(state);
  if (state.screen === "profile") return profileScreen(state);
  if (state.screen === "settings") return settingsScreen(state);
  if (state.screen === "discover") return discoverScreen(state);
  return friendsScreen(state);
}

function setupScreen() {
  return `
    <section class="center-state">
      <h1>${tr.brand}</h1>
      <p>Supabase env degerleri eksik. SUPABASE_URL ve SUPABASE_ANON_KEY tanimlaninca gercek test ortami acilir.</p>
    </section>
  `;
}

function authScreen(state) {
  const signup = state.authMode === "signup";
  return `
    <section class="auth-screen">
      <h1>${tr.brand}</h1>
      <p>Gercek test hesabi ile devam et.</p>
      <div class="segmented">
        <button class="${!signup ? "selected" : ""}" data-auth-mode="signin">Giris</button>
        <button class="${signup ? "selected" : ""}" data-auth-mode="signup">Kayit</button>
      </div>
      <form class="auth-form" data-auth-form>
        ${signup ? `
          <input name="name" value="${escapeAttr(state.authForm.name)}" placeholder="Ad" required />
          <input name="surname" value="${escapeAttr(state.authForm.surname)}" placeholder="Soyad" required />
          <input name="username" value="${escapeAttr(state.authForm.username)}" placeholder="@username" required />
          <input name="profilePhoto" type="file" accept="image/*" />
        ` : ""}
        <input name="email" value="${escapeAttr(state.authForm.email)}" type="email" placeholder="Email" required />
        <input name="password" value="${escapeAttr(state.authForm.password)}" type="password" placeholder="Password" required />
        <button>${signup ? "Kayit ol" : "Giris yap"}</button>
      </form>
      ${state.error ? `<p class="error-text">${state.error}</p>` : ""}
    </section>
  `;
}

function friendsScreen(state) {
  return `
    <section class="stack">
      <label class="search-box">
        <span>Kullanici ara</span>
        <input value="${escapeAttr(state.searchQuery)}" data-search-people placeholder="Ad veya @username ara" />
      </label>
      ${state.searchQuery ? searchResults(state) : ""}
      <div class="section-head">
        <h3>${tr.newRequests}</h3>
        <span>${state.incomingRequests.length}</span>
      </div>
      ${state.incomingRequests.map(requestCard).join("") || emptyState("Henüz gelen istek yok.")}
      <div class="section-head">
        <h3>${tr.friends}</h3>
        <span>${state.friends.length}</span>
      </div>
      ${state.friends.map(friendListCard).join("") || emptyState("Henüz arkadaşın yok.")}
    </section>
  `;
}

function searchResults(state) {
  return `
    <div class="section-head">
      <h3>${tr.searchResults}</h3>
      <span>${state.searchResults.length}</span>
    </div>
    ${state.searchResults.map((person) => `
      <article class="person-card">
        ${avatar(person)}
        <div class="person-main">
          <strong>${displayName(person)}</strong>
          <small>@${person.username || ""}</small>
        </div>
        <button class="small-action" data-friend-request="${person.id}">İstek gönder</button>
      </article>
    `).join("") || emptyState("Kullanıcı bulunamadı.")}
  `;
}

function requestCard(request) {
  const person = request.sender;
  return `
    <article class="person-card">
      ${avatar(person)}
      <div class="person-main">
        <strong>${displayName(person)}</strong>
        <small>@${person.username || ""}</small>
      </div>
      <div class="person-actions">
        <button class="small-action" data-accept-request="${request.id}">Kabul et</button>
        <button class="small-action muted-action" data-reject-request="${request.id}">Reddet</button>
      </div>
    </article>
  `;
}

function friendListCard(person) {
  return `
    <article class="person-card">
      ${avatar(person)}
      <div class="person-main">
        <strong>${displayName(person)}</strong>
        <small>@${person.username || ""} &middot; ${person.friend_count || 0} ${tr.friendCount}</small>
      </div>
    </article>
  `;
}

function cameraScreen(state) {
  return `
    <section class="camera-wrap">
      <label class="search-box">
        <span>Moment alıcısı</span>
        <select data-active-person>
          <option value="">Arkadaş seç</option>
          ${state.friends.map((person) => `<option value="${person.id}" ${state.activePersonId === person.id ? "selected" : ""}>${displayName(person)}</option>`).join("")}
        </select>
      </label>
      <div class="camera-preview" data-camera-host>
        <video autoplay playsinline muted></video>
        <div class="camera-fallback">
          <div class="lens"></div>
          <strong>${tr.placeholderCamera}</strong>
          <span>${tr.cameraPermission}</span>
        </div>
      </div>
      <div class="camera-controls">
        <button class="round-control" data-action="capture" title="${tr.capture}"></button>
      </div>
      ${state.friends.length ? "" : emptyState("Moment göndermek için önce arkadaş eklemelisin.")}
    </section>
  `;
}

function previewScreen(state) {
  const image = state.capturedMoment?.dataUrl || state.capturedMoment?.remoteUrl || "";
  const ownMoment = state.capturedMoment?.own !== false;
  return `
    <section class="preview-wrap">
      <div class="moment-frame">${image ? `<img src="${image}" alt="Moment onizleme" />` : `<div class="generated-moment">Moment</div>`}</div>
      <div class="preview-actions">
        ${ownMoment ? `<button data-action="save">${tr.save}</button><button data-action="send-moment">Moment gönder</button>` : ""}
        <button data-action="close-preview">${state.returnAfterPreview === "chat" ? tr.chat : tr.back}</button>
      </div>
    </section>
  `;
}

function chatScreen(state) {
  if (state.activeChatId) return chatDetailScreen(state);
  return `
    <section class="stack">
      <div class="chat-list">
        ${state.friends.map((person) => chatListCard(state, person)).join("") || emptyState("Henüz sohbet yok.")}
      </div>
    </section>
  `;
}

function chatListCard(state, person) {
  const chat = chatForFriend(state, person.id);
  const messages = chat ? state.messages.filter((message) => message.chat_id === chat.id) : [];
  const hasMoment = state.moments.some((moment) => moment.sender_id === person.id);
  const hasMessage = messages.length > 0;
  return `
    <button class="chat-row" data-open-chat="${person.id}">
      ${avatar(person)}
      <div class="person-main">
        <strong>${displayName(person)}</strong>
        <div class="status-dots">
          ${hasMoment ? `<span class="status-dot moment-dot"></span>` : ""}
          ${hasMessage ? `<span class="status-dot message-dot"></span>` : ""}
        </div>
      </div>
    </button>
  `;
}

function chatDetailScreen(state) {
  const person = activeChatPerson(state);
  const chat = person ? chatForFriend(state, person.id) : null;
  const messages = chat ? state.messages.filter((message) => message.chat_id === chat.id) : [];
  return `
    <section class="stack chat-detail">
      <button class="back-button" data-action="back-chat">${tr.back}</button>
      <div class="chat-list">
        ${messages.map((message) => `
          <article class="bubble ${message.sender_id === state.session.user.id ? "mine" : ""}" data-message-menu="${message.id}">
            <small>${new Date(message.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</small>
            <p>${escapeHtml(message.body)}</p>
            ${state.messageMenuId === message.id ? `
              <div class="message-menu">
                <button data-delete-message="${message.id}">${tr.deleteEveryone}</button>
                <button data-delete-self="${message.id}">${tr.deleteSelf}</button>
              </div>
            ` : ""}
          </article>
        `).join("") || emptyState("Henüz mesaj yok.")}
      </div>
      <form class="message-form" data-message-form>
        <input name="message" placeholder="Mesaj yaz" autocomplete="off" />
        <button>Gönder</button>
      </form>
    </section>
  `;
}

function profileScreen(state) {
  const profile = state.profile;
  if (!profile) return emptyState("Profil bilgisi bulunamadı.");
  const score = totalScore(profile);
  return `
    <section class="profile">
      ${avatar(profile, "profile-avatar")}
      <h1>${displayName(profile)}</h1>
      <p>@${profile.username || ""}</p>
      <div class="metric-grid">
        <div class="metric"><strong>${profile.friend_count || state.friends.length}</strong><span>${tr.friendCount}</span></div>
        <div class="metric"><strong>${score}</strong><span>${tr.totalScore}</span></div>
        <div class="metric"><strong>${profile.total_moments_sent || 0}</strong><span>${tr.totalSent}</span></div>
        <div class="metric"><strong>${profile.total_moments_opened || 0}</strong><span>${tr.totalOpened}</span></div>
      </div>
    </section>
  `;
}

function settingsScreen(state) {
  return `
    <section class="stack">
      <article class="settings-row">
        <div><strong>${tr.theme}</strong><small>${state.theme === "dark" ? tr.dark : tr.light}</small></div>
        <div class="segmented">
          <button class="${state.theme === "light" ? "selected" : ""}" data-theme="light">${tr.light}</button>
          <button class="${state.theme === "dark" ? "selected" : ""}" data-theme="dark">${tr.dark}</button>
        </div>
      </article>
      <button class="small-action" data-action="sign-out">Çıkış yap</button>
    </section>
  `;
}

function discoverScreen(state) {
  const ranked = [...state.discover].sort((a, b) => totalScore(b) - totalScore(a));
  return `
    <section class="stack">
      ${ranked.map((person, index) => `
        <article class="discover-user-card">
          <div class="rank">${index + 1}</div>
          ${avatar(person)}
          <div class="person-main">
            <strong>${displayName(person)}</strong>
            <small>@${person.username || ""} &middot; ${person.friend_count || 0} ${tr.friendCount}</small>
          </div>
          <div class="score-badge"><strong>${totalScore(person)}</strong><span>${tr.totalScore}</span></div>
          <div class="stat-strip">
            <span>${person.total_moments_sent || 0}<small>${tr.totalSent}</small></span>
            <span>${person.total_moments_opened || 0}<small>${tr.totalOpened}</small></span>
          </div>
        </article>
      `).join("") || emptyState("Keşfet için kullanıcı bulunamadı.")}
    </section>
  `;
}

function bind(root, dispatch) {
  root.querySelectorAll("[data-screen]").forEach((button) => button.addEventListener("click", () => dispatch({ type: "screen", screen: button.dataset.screen })));
  root.querySelectorAll("[data-theme]").forEach((button) => button.addEventListener("click", () => dispatch({ type: "theme", theme: button.dataset.theme })));
  root.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => dispatch({ type: "authMode", mode: button.dataset.authMode })));
  root.querySelectorAll("[data-search-people]").forEach((input) => input.addEventListener("input", () => dispatch({ type: "search", query: input.value })));
  root.querySelectorAll("[data-friend-request]").forEach((button) => button.addEventListener("click", () => dispatch({ type: "friendRequest", id: button.dataset.friendRequest })));
  root.querySelectorAll("[data-accept-request]").forEach((button) => button.addEventListener("click", () => dispatch({ type: "requestResponse", id: button.dataset.acceptRequest, accepted: true })));
  root.querySelectorAll("[data-reject-request]").forEach((button) => button.addEventListener("click", () => dispatch({ type: "requestResponse", id: button.dataset.rejectRequest, accepted: false })));
  root.querySelectorAll("[data-open-chat]").forEach((button) => button.addEventListener("click", () => dispatch({ type: "openChat", id: button.dataset.openChat })));
  root.querySelectorAll("[data-active-person]").forEach((select) => select.addEventListener("change", () => dispatch({ type: "activePerson", id: select.value })));
  root.querySelectorAll("[data-delete-message]").forEach((button) => button.addEventListener("click", () => dispatch({ type: "deleteMessage", id: button.dataset.deleteMessage })));
  root.querySelectorAll("[data-delete-self]").forEach((button) => button.addEventListener("click", () => dispatch({ type: "deleteSelf", id: button.dataset.deleteSelf })));
  root.querySelectorAll("[data-message-menu]").forEach((message) => message.addEventListener("dblclick", () => dispatch({ type: "messageMenu", id: message.dataset.messageMenu })));
  root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => dispatch({ type: button.dataset.action })));
  root.querySelectorAll("[data-auth-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    dispatch({ type: "authSubmit", form });
  }));
  root.querySelectorAll("[data-message-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    dispatch({ type: "sendMessage", text: new FormData(form).get("message") });
  }));
  startCamera(root);
}

async function handleAction(state, action, root) {
  state.notice = "";
  state.error = "";
  try {
    if (action.type === "screen") {
      state.screen = action.screen;
      if (action.screen !== "chat") state.activeChatId = "";
      state.messageMenuId = "";
    }
    if (action.type === "theme") setTheme(state, action.theme);
    if (action.type === "authMode") state.authMode = action.mode;
    if (action.type === "authSubmit") {
      readAuthForm(state, action.form);
      if (state.authMode === "signup") await signUp(state);
      else await signIn(state);
    }
    if (action.type === "sign-out") await signOut(state);
    if (action.type === "search") {
      state.focusSearch = true;
      await searchUsers(state, action.query);
    }
    if (action.type === "friendRequest") {
      await sendFriendRequest(state, action.id);
      state.notice = "Arkadaş isteği gönderildi.";
    }
    if (action.type === "requestResponse") await respondFriendRequest(state, action.id, action.accepted);
    if (action.type === "activePerson") state.activePersonId = action.id;
    if (action.type === "openChat") await openChatAction(state, action.id);
    if (action.type === "sendMessage") await sendMessage(state, action.text || "");
    if (action.type === "deleteMessage") await deleteMessageForEveryone(state, action.id);
    if (action.type === "deleteSelf") await deleteMessageForSelf(state, action.id);
    if (action.type === "messageMenu") state.messageMenuId = state.messageMenuId === action.id ? "" : action.id;
    if (action.type === "back-chat") state.activeChatId = "";
    if (action.type === "capture") captureMoment(state, root);
    if (action.type === "save") saveMoment(state);
    if (action.type === "send-moment") await sendCapturedMoment(state);
    if (action.type === "close-preview") closePreview(state);
    if (action.type === "refresh") await initBackend(state);
  } catch (error) {
    state.error = error.message;
    state.notice = error.message;
  }
}

async function openChatAction(state, friendId) {
  const blockingMoment = state.moments.find((moment) => moment.sender_id === friendId);
  state.activeChatId = friendId;
  if (blockingMoment) {
    const signedUrl = await openMoment(state, blockingMoment.id);
    state.capturedMoment = { own: false, remoteUrl: signedUrl };
    state.returnAfterPreview = "chat";
    state.screen = "preview";
    return;
  }
  state.screen = "chat";
}

async function sendCapturedMoment(state) {
  if (!state.activePersonId || !state.capturedMoment?.blob) {
    state.notice = "Moment göndermek için arkadaş seç.";
    return;
  }
  if (!state.friends.some((friend) => friend.id === state.activePersonId)) {
    state.notice = "Moment yalnızca arkadaşlara gönderilebilir.";
    return;
  }
  if (state.moments.some((moment) => moment.sender_id === state.activePersonId)) {
    state.notice = "Önce bu arkadaşından gelen Moment'i açmalısın.";
    return;
  }
  await sendMoment(state, state.activePersonId, state.capturedMoment.blob);
  state.notice = "Moment gönderildi.";
  state.capturedMoment = null;
  state.screen = "chat";
}

function readAuthForm(state, form) {
  const data = new FormData(form);
  state.authForm = {
    name: data.get("name") || "",
    surname: data.get("surname") || "",
    username: String(data.get("username") || "").replace(/^@/, ""),
    email: data.get("email") || "",
    password: data.get("password") || "",
    profilePhoto: data.get("profilePhoto")?.size ? data.get("profilePhoto") : null
  };
}

async function startCamera(root) {
  const host = root.querySelector("[data-camera-host]");
  const video = host?.querySelector("video");
  if (!host || !video || !navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream;
    host.classList.add("camera-live");
  } catch {
    host.classList.remove("camera-live");
  }
}

function captureMoment(state, root) {
  const video = root.querySelector(".camera-live video");
  if (!video?.videoWidth) {
    state.notice = "Kamera aktif değil. Tarayıcı kamera izni gerekli.";
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    state.capturedMoment = { own: true, dataUrl: canvas.toDataURL("image/png"), blob };
    state.screen = "preview";
    root.dispatchEvent(new Event("moments-rerender"));
  }, "image/png");
}

function closePreview(state) {
  if (state.returnAfterPreview === "chat") {
    state.returnAfterPreview = "";
    state.screen = "chat";
    return;
  }
  state.returnAfterPreview = "";
  state.screen = "camera";
}

function saveMoment(state) {
  if (!state.capturedMoment?.dataUrl || state.capturedMoment.own === false) return;
  const link = document.createElement("a");
  link.href = state.capturedMoment.dataUrl;
  link.download = "moments-test-moment.png";
  link.click();
  state.notice = "Moment cihaza indirildi.";
}

function avatar(person, className = "avatar") {
  if (person?.profile_photo_url) return `<img class="${className}" src="${person.profile_photo_url}" alt="" />`;
  return `<div class="${className}">${initialsFor(person)}</div>`;
}

function emptyState(text) {
  return `<p class="empty-state">${text}</p>`;
}

function chatForFriend(state, friendId) {
  const userId = state.session.user.id;
  return state.chats.find((chat) =>
    (chat.member_a === userId && chat.member_b === friendId) ||
    (chat.member_b === userId && chat.member_a === friendId)
  );
}

function activeChatPerson(state) {
  return state.friends.find((person) => person.id === state.activeChatId);
}

function restoreSearchFocus(root, state) {
  if (!state.focusSearch) return;
  const input = root.querySelector("[data-search-people]");
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  state.focusSearch = false;
}

function escapeAttr(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return escapeAttr(value).replaceAll("'", "&#039;");
}
