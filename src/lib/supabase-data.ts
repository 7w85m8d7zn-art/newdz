import "server-only"

import type { PostgrestError } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const SUPABASE_CONNECTION_ERROR_PATTERNS = [
  "fetch failed",
  "network",
  "econnreset",
  "econnrefused",
  "enotfound",
  "getaddrinfo",
  "timed out",
  "dns",
  "can't reach database server",
]

const SUPABASE_CONFIGURATION_ERROR_PATTERNS = [
  "next_public_supabase_url is not defined",
  "next_public_supabase_publishable_default_key is not defined",
  "supabase_service_role_key is not defined",
]

function includesConnectionError(text: string) {
  const normalized = text.toLowerCase()
  return SUPABASE_CONNECTION_ERROR_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  )
}

function getOptionalErrorDetails(error: unknown) {
  if (!error || typeof error !== "object" || !("details" in error)) {
    return ""
  }

  const details = (error as { details?: unknown }).details

  return typeof details === "string" ? details : ""
}

export function getSupabaseAdminClient() {
  return createSupabaseServerClient()
}

export function throwIfSupabaseError(
  error: PostgrestError | null,
  context: string,
) {
  if (!error) {
    return
  }

  const details = error.details ?? ""
  const normalizedMessage = `${error.message} ${details}`.toLowerCase()

  if (
    normalizedMessage.includes("could not find the table") ||
    normalizedMessage.includes("schema cache")
  ) {
    throw new Error(
      `${context}: Supabase tablolari Data API tarafinda gorunmuyor. SQL Editor'de once supabase/schema.sql calistirin ve Settings > API > Exposed schemas icinde public secili oldugunu kontrol edin. seed.sql sadece ornek veri icindir (tekrar calisirsa urunler geri gelebilir). Orijinal hata: ${error.message}`,
    )
  }

  if (includesConnectionError(normalizedMessage)) {
    throw new Error(
      `${context}: Supabase baglantisi kurulamadi. NEXT_PUBLIC_SUPABASE_URL degerini, internet/DNS baglantisini ve Supabase projesinin aktif oldugunu kontrol edin. Lokal fallback ile devam etmek icin .env icinde ENABLE_CONTENT_FALLBACK=\"true\" kullanabilirsiniz. Orijinal hata: ${error.message}${details ? ` (${details})` : ""}`,
    )
  }

  throw new Error(`${context}: ${error.message}${details ? ` (${details})` : ""}`)
}

export function isSupabaseConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const details = getOptionalErrorDetails(error)
  const message = `${error.message} ${details}`.toLowerCase()

  return includesConnectionError(message)
}

function isSupabaseConfigurationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return SUPABASE_CONFIGURATION_ERROR_PATTERNS.some((pattern) =>
    message.includes(pattern),
  )
}

function isContentFallbackEnabled() {
  const value = process.env.ENABLE_CONTENT_FALLBACK?.trim().toLowerCase()
  return value === "true" || value === "1"
}

export function shouldUseSupabaseFallback(error: unknown) {
  // Ziyaretçi sayfaları, deployment sırasında Supabase henüz
  // yapılandırılmamış olsa bile repodaki tam menüyle üretilebilsin.
  if (isSupabaseConfigurationError(error)) {
    return true
  }

  if (!isSupabaseConnectionError(error)) {
    return false
  }

  if (isContentFallbackEnabled()) {
    return true
  }

  // Dev ortaminda baglanti sorunu yuzunden sayfayi tamamen dusurmek yerine
  // fallback veriyle acik tutuyoruz. Production davranisi degismez.
  return process.env.NODE_ENV === "development"
}

export function toNumberValue(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}
