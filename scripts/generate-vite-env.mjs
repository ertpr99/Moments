import { mkdirSync, writeFileSync } from "node:fs";

const publicEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
  STORAGE_BUCKET_NAME: process.env.STORAGE_BUCKET_NAME || process.env.VITE_STORAGE_BUCKET_NAME || "moments"
};

mkdirSync("src/lib", { recursive: true });
writeFileSync(
  "src/lib/env.generated.js",
  `export const env = ${JSON.stringify(publicEnv, null, 2)};\n`
);
