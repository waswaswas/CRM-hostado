import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const ADMIN_CONFIG_MESSAGE =
  'Admin features require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment (e.g. .env.local).'

/**
 * Server-only Supabase client with service role. Use only in server actions/API routes
 * for admin operations (list users, update auth, etc.). Never expose to the client.
 * Returns null when env vars are missing so callers can show a friendly error instead of throwing.
 */
export function createAdminClient(): SupabaseClient | null {
  if (!url || !serviceRoleKey || url.includes('placeholder')) {
    return null
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/** Use when you need a human-readable error for missing admin config. */
export function getAdminConfigError(): string | null {
  if (!url || !serviceRoleKey || url.includes('placeholder')) {
    return ADMIN_CONFIG_MESSAGE
  }
  return null
}
