import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = "dist";
const assetsDir = join(outDir, "assets");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(assetsDir, { recursive: true });

writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#EEE9C8" />
    <title>Moments</title>
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="stylesheet" href="/assets/fallback.css" />
  </head>
  <body>
    <main class="shell">
      <section class="panel">
        <p class="eyebrow">Moments Beta</p>
        <h1>Paylasmaya hazir sicak, sade ve gercek bir Moment deneyimi.</h1>
        <p class="copy">
          Bu Vercel fallback ciktisidir. Normal ortamda Vite React uygulamasi build edilir.
          Supabase degiskenleri eklendiginde kayit, arkadaslik, sohbet, kamera ve Moment akisina baglanir.
        </p>
        <div class="actions">
          <span>Arkadaslar</span>
          <span>Sohbet</span>
          <span>Kamera</span>
          <span>Kesfet</span>
        </div>
      </section>
    </main>
    <script type="module" src="/assets/fallback.js"></script>
  </body>
</html>
`
);

writeFileSync(
  join(assetsDir, "fallback.css"),
  `:root {
  color-scheme: light;
  background: #eee9c8;
  color: #c76e7a;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(231, 141, 85, 0.24), transparent 34rem),
    linear-gradient(135deg, #eee9c8 0%, #eadab8 100%);
}

.shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 28px;
}

.panel {
  width: min(720px, 100%);
  border: 1px solid rgba(199, 110, 122, 0.22);
  border-radius: 22px;
  background: rgba(238, 233, 200, 0.74);
  box-shadow: 0 24px 70px rgba(83, 54, 44, 0.16);
  padding: clamp(28px, 6vw, 56px);
}

.eyebrow {
  margin: 0 0 14px;
  color: #d9784e;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  max-width: 680px;
  color: #c76e7a;
  font-size: clamp(34px, 7vw, 68px);
  line-height: 0.98;
  letter-spacing: 0;
}

.copy {
  margin: 22px 0 0;
  color: #665950;
  font-size: 17px;
  line-height: 1.7;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}

.actions span {
  border-radius: 999px;
  background: #d9784e;
  color: #f6ecd6;
  padding: 10px 14px;
  font-weight: 800;
}
`
);

writeFileSync(
  join(assetsDir, "fallback.js"),
  `console.info("Moments fallback build served. Vite React build should replace this in normal deployments.");\n`
);

writeFileSync(
  join(outDir, "manifest.webmanifest"),
  JSON.stringify(
    {
      name: "Moments",
      short_name: "Moments",
      start_url: "/",
      display: "standalone",
      background_color: "#EEE9C8",
      theme_color: "#C76E7A",
    },
    null,
    2
  )
);

console.log("Fallback dist created at dist/index.html");
