import { createClient } from "@supabase/supabase-js";
import { env } from "./env.generated.js";

export const appEnv = {
  supabaseUrl: env.SUPABASE_URL,
  supabaseAnonKey: env.SUPABASE_ANON_KEY,
  storageBucketName: env.STORAGE_BUCKET_NAME || "moments"
};

export const hasSupabaseConfig = Boolean(appEnv.supabaseUrl && appEnv.supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey)
  : null;
