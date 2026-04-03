import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const PREFIX = 'v1'

function deriveKey(): Buffer | null {
  const secret = process.env.ASSISTANTS_ENCRYPTION_SECRET?.trim()
  if (!secret) return null
  return createHash('sha256').update(secret, 'utf8').digest()
}

/** Encrypt for JSON storage. Returns null if encryption secret is not configured. */
export function encryptOrgOpenaiKey(plain: string): string | null {
  const key = deriveKey()
  if (!key) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':')
}

export function decryptOrgOpenaiKey(stored: string): string | null {
  const key = deriveKey()
  if (!key) return null
  try {
    const parts = stored.split(':')
    if (parts.length !== 4 || parts[0] !== PREFIX) return null
    const [, ivHex, tagHex, dataHex] = parts
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    const out = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ])
    return out.toString('utf8')
  } catch {
    return null
  }
}

export type PersistedOpenaiKeyFields = {
  openai_api_key_encrypted?: string
  openai_api_key?: string
}

/** Persist key: prefer encrypted when ASSISTANTS_ENCRYPTION_SECRET is set. */
export function persistOpenaiKeyFields(plain: string): PersistedOpenaiKeyFields {
  const enc = encryptOrgOpenaiKey(plain)
  if (enc) {
    return { openai_api_key_encrypted: enc }
  }
  return { openai_api_key: plain }
}

export function readOpenaiKeyFromAssistantsRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.openai_api_key_encrypted === 'string' && o.openai_api_key_encrypted) {
    const dec = decryptOrgOpenaiKey(o.openai_api_key_encrypted)
    if (dec) return dec
    return null
  }
  if (typeof o.openai_api_key === 'string' && o.openai_api_key.trim()) {
    return o.openai_api_key.trim()
  }
  return null
}

export function hasStoredOpenaiKey(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return Boolean(
    (typeof o.openai_api_key_encrypted === 'string' && o.openai_api_key_encrypted.length > 0) ||
    (typeof o.openai_api_key === 'string' && o.openai_api_key.trim().length > 0)
  )
}

export function isKeyStoredEncrypted(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return typeof o.openai_api_key_encrypted === 'string' && o.openai_api_key_encrypted.length > 0
}
