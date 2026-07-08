import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(fileURLToPath(new URL("../", import.meta.url)));
const output = join(root, "moments/app/shared/config/env.js");
const localEnvPath = join(root, ".env.local");

if (existsSync(localEnvPath)) {
  const lines = readFileSync(localEnvPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const publicConfig = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
  STORAGE_BUCKET_NAME: process.env.STORAGE_BUCKET_NAME || "moments"
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `export const env = ${JSON.stringify(publicConfig, null, 2)};\n`, "utf8");

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Server-only SUPABASE_SERVICE_ROLE_KEY detected and intentionally not written to client config.");
}

if (!publicConfig.SUPABASE_URL || !publicConfig.SUPABASE_ANON_KEY) {
  console.log("Supabase public config is incomplete. Set SUPABASE_URL and SUPABASE_ANON_KEY before deploying.");
}
