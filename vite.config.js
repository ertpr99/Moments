import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    define: {
      __MOMENTS_ENV__: JSON.stringify({
        SUPABASE_URL: env.SUPABASE_URL || "",
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || "",
        STORAGE_BUCKET_NAME: env.STORAGE_BUCKET_NAME || "moments"
      })
    }
  };
});
