import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "./env"

export function createSupabaseServerClient() {
  const env = getSupabaseServerEnv()

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
