import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import "./generate-env.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

copyFileSync(join(root, "index.html"), join(dist, "index.html"));

mkdirSync(join(dist, "moments"), { recursive: true });
cpSync(join(root, "moments/app"), join(dist, "moments/app"), { recursive: true });
cpSync(join(root, "moments/preview-dashboard"), join(dist, "moments/preview-dashboard"), {
  recursive: true,
  filter: (source) => !source.endsWith("server.js")
});
cpSync(join(root, "moments/landing-page"), join(dist, "moments/landing-page"), { recursive: true });

console.log("Static build ready in dist/");
