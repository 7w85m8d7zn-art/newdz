import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env"

export function createSupabaseBrowserClient() {
  const env = getSupabasePublicEnv()

  return createClient(env.supabaseUrl, env.supabasePublishableKey)
}
