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
    discover: [],
    searchQuery: "",
    searchResults: [],
    activePersonId: "",
    activeChatId: "",
    capturedMoment: null,
    returnAfterPreview: "",
    messageMenuId: "",
    focusSearch: false,
    notice: "",
    error: ""
  };
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
  const blockingMoment = state.moments.some((moment) => moment.sender_id === personId && !moment.opened_at && !moment.expired);
  return friend && !blockingMoment;
}
