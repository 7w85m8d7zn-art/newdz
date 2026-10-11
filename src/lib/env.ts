function requireEnv(name: string, value: string | undefined) {
  const normalizedValue = value?.trim()

  if (!normalizedValue) {
    throw new Error(`${name} is not defined.`)
  }

  return normalizedValue
}

export function getSupabasePublicEnv() {
  return {
    supabaseUrl: requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    supabasePublishableKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    ),
  }
}

export function getSupabaseServerEnv() {
  return {
    ...getSupabasePublicEnv(),
    supabaseServiceRoleKey: requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  }
}
