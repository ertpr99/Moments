import { env } from "../config/env.js";

let clientPromise;

export function hasSupabaseConfig() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

export async function getSupabase() {
  if (!hasSupabaseConfig()) return null;
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) =>
      createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      })
    );
  }
  return clientPromise;
}

export function storageBucketName() {
  return env.STORAGE_BUCKET_NAME || "moments";
}
