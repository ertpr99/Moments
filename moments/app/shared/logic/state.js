export function createAppState(platform) {
  return {
    platform,
    screen: "home",
    theme: localStorage.getItem("moments-theme") || "light",
    loading: true,
    configured: false,
    session: null,
    profile: null,
    authMode: "signin",
    authForm: {
      name: "",
      surname: "",
      username: "",
      email: "",
      password: "",
      profilePhoto: null
    },
    people: [],
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    chats: [],
    messages: [],
    moments: [],
    readMessageIds: readMessageIds(),
    discover: [],
    searchQuery: "",
    searchResults: [],
    activePersonId: "",
    activeChatId: "",
    activeMomentQueue: [],
    activeMomentIndex: 0,
    capturedMoment: null,
    returnAfterPreview: "",
    messageMenuId: "",
    focusSearch: false,
    notice: "",
    error: ""
  };
}

function readMessageIds() {
  try {
    return JSON.parse(localStorage.getItem("moments-read-message-ids") || "[]");
  } catch {
    return [];
  }
}

export function setTheme(state, theme) {
  state.theme = theme;
  localStorage.setItem("moments-theme", theme);
}

export function totalScore(person) {
  return (person.total_moments_sent || 0) + (person.total_moments_opened || 0);
}

export function initialsFor(person) {
  const first = person?.name?.[0] || "";
  const second = person?.surname?.[0] || person?.username?.[0] || "";
  return `${first}${second}`.toUpperCase() || "MO";
}

export function displayName(person) {
  return [person?.name, person?.surname].filter(Boolean).join(" ") || person?.username || "Moments";
}

export function canSendMomentTo(state, personId) {
  const friend = state.friends.some((person) => person.id === personId);
  const blockingMoment = state.moments.some((moment) => moment.sender_id === personId && (moment.open_count || 0) === 0 && !moment.expired);
  return friend && !blockingMoment;
}
