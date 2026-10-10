import { scryptSync, timingSafeEqual } from "node:crypto"

function normalizeEmail(value: string) {
  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .toLowerCase()
}

function getAdminCredentials() {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim()
  const configuredPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim()

  if (!configuredEmail || !configuredPasswordHash) {
    throw new Error(
      "ADMIN_EMAIL ve ADMIN_PASSWORD_HASH ortam degiskenleri zorunludur.",
    )
  }

  return {
    email: normalizeEmail(configuredEmail),
    name: process.env.ADMIN_NAME?.trim() || "Zeki Admin",
    passwordHash: configuredPasswordHash,
  }
}

export function verifyPassword(password: string, storedHash: string) {
  const normalized = storedHash
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\s+/g, "")

  const match = normalized.match(/^([a-zA-Z0-9_-]+):([0-9a-fA-F]+):([0-9a-fA-F]+)$/)

  if (!match) {
    return false
  }

  const [, algorithm, salt, hash] = match

  if (algorithm.toLowerCase() !== "scrypt" || !salt || !hash) {
    return false
  }

  const derivedKey = scryptSync(password, salt, 64)
  const hashBuffer = Buffer.from(hash, "hex")

  if (derivedKey.length !== hashBuffer.length) {
    return false
  }

  return timingSafeEqual(derivedKey, hashBuffer)
}

export async function authenticateAdmin(email: string, password: string) {
  const admin = getAdminCredentials()

  if (normalizeEmail(email) !== admin.email) {
    return null
  }

  const isValid = verifyPassword(password, admin.passwordHash)

  if (!isValid) {
    return null
  }

  return {
    email: admin.email,
    name: admin.name,
    role: "admin" as const,
  }
}
