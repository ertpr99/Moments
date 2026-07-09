import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const url = env.SUPABASE_URL;
const anon = env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const bucket = env.STORAGE_BUCKET_NAME || "moments";
const results = [];

function add(name, ok, detail) {
  results.push({ name, ok, detail });
}

async function request(path, options = {}, token = anon) {
  const headers = {
    apikey: anon,
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };
  const response = await fetch(`${url}${path}`, { ...options, headers });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data, text };
}

async function testRealtime(accessToken) {
  if (typeof WebSocket === "undefined") {
    return { ok: false, detail: "Node runtime WebSocket desteklemiyor." };
  }

  return new Promise((resolve) => {
    const websocketUrl = `${url.replace("https://", "wss://").replace("http://", "ws://")}/realtime/v1/websocket?apikey=${encodeURIComponent(anon)}&vsn=1.0.0`;
    const timeout = setTimeout(() => resolve({ ok: false, detail: "Realtime websocket timeout." }), 8000);
    const socket = new WebSocket(websocketUrl);

    socket.onopen = () => {
      socket.send(JSON.stringify({
        topic: "realtime:public:messages",
        event: "phx_join",
        payload: {
          config: {
            postgres_changes: [{ event: "*", schema: "public", table: "messages" }]
          },
          access_token: accessToken
        },
        ref: "1"
      }));
    };

    socket.onmessage = (event) => {
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        // no-op
      }
      resolve({ ok: true, detail: String(event.data).slice(0, 180) });
    };

    socket.onerror = () => {
      clearTimeout(timeout);
      resolve({ ok: false, detail: "Realtime websocket error." });
    };
  });
}

async function main() {
  if (!url || !anon) {
    add("Config", false, "SUPABASE_URL veya SUPABASE_ANON_KEY eksik.");
    console.log(JSON.stringify(results, null, 2));
    process.exitCode = 1;
    return;
  }

  add("Config", true, `URL=${url}, bucket=${bucket}`);

  const schemaRead = await request("/rest/v1/profiles?select=id&limit=1");
  add("Database schema/read endpoint", schemaRead.response.ok, `${schemaRead.response.status} ${schemaRead.response.statusText}${schemaRead.response.ok ? "" : ` ${schemaRead.text.slice(0, 220)}`}`);

  const stamp = Date.now();
  const email = `moments_connectivity_${stamp}@example.com`;
  const password = `Moments-${stamp}!`;
  const username = `conn_${String(stamp).slice(-8)}`;

  const signup = await request("/auth/v1/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      data: { name: "Connectivity", surname: "Test", username }
    })
  });

  const user = signup.data?.user;
  const session = signup.data?.access_token ? signup.data : signup.data?.session;
  add("Auth signup", signup.response.ok && Boolean(user?.id), `${signup.response.status} ${signup.response.statusText}${user?.id ? ` user=${user.id}` : ` ${signup.text.slice(0, 220)}`}`);

  if (!session?.access_token || !user?.id) {
    add("Authenticated Database write/read", false, "Session gelmedi. Email confirmation acik olabilir; email onayi kapat veya test kullanicisini onaylayip uygulamadan giris yap.");
    add("Storage upload/signed URL", false, "Authenticated session olmadigi icin atlandi.");
    add("Realtime websocket", false, "Authenticated session olmadigi icin atlandi.");
    console.log(JSON.stringify(results, null, 2));
    process.exitCode = 1;
    return;
  }

  const profileInsert = await request("/rest/v1/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      id: user.id,
      name: "Connectivity",
      surname: "Test",
      username,
      email,
      profile_photo_url: null
    })
  }, session.access_token);
  add("Database profile insert", profileInsert.response.ok, `${profileInsert.response.status} ${profileInsert.response.statusText}${profileInsert.response.ok ? "" : ` ${profileInsert.text.slice(0, 220)}`}`);

  const profileRead = await request(`/rest/v1/profiles?id=eq.${user.id}&select=id,username,total_score`, {}, session.access_token);
  add("Database authenticated read", profileRead.response.ok && Array.isArray(profileRead.data) && profileRead.data.length === 1, `${profileRead.response.status} ${profileRead.response.statusText} rows=${Array.isArray(profileRead.data) ? profileRead.data.length : "n/a"}`);

  const storagePath = `${user.id}/connectivity-test.txt`;
  const upload = await request(`/storage/v1/object/${bucket}/${storagePath}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "x-upsert": "true" },
    body: "moments connectivity test"
  }, session.access_token);
  add("Storage upload", upload.response.ok, `${upload.response.status} ${upload.response.statusText}${upload.response.ok ? "" : ` ${upload.text.slice(0, 220)}`}`);

  const signed = await request(`/storage/v1/object/sign/${bucket}/${storagePath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 })
  }, session.access_token);
  add("Storage signed URL", signed.response.ok && Boolean(signed.data?.signedURL || signed.data?.signedUrl), `${signed.response.status} ${signed.response.statusText}${signed.response.ok ? "" : ` ${signed.text.slice(0, 220)}`}`);

  const realtime = await testRealtime(session.access_token);
  add("Realtime websocket/publication", realtime.ok, realtime.detail);

  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

main().catch((error) => {
  add("Fatal", false, error.stack || error.message);
  console.log(JSON.stringify(results, null, 2));
  process.exitCode = 1;
});
