import { createClient } from "@supabase/supabase-js";

const env = typeof __MOMENTS_ENV__ === "undefined" ? {} : __MOMENTS_ENV__;

export const appEnv = {
  supabaseUrl: env.SUPABASE_URL || "",
  supabaseAnonKey: env.SUPABASE_ANON_KEY || "",
  storageBucketName: env.STORAGE_BUCKET_NAME || "moments"
};

export const hasSupabaseConfig = Boolean(appEnv.supabaseUrl && appEnv.supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : null;
