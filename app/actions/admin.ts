'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, getAdminConfigError } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import crypto from 'crypto'

const ADMIN_EMAIL = 'waswaswas28@gmail.com'
const ADMIN_COOKIE_NAME = 'admin_center_session'
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours
const CONFIG_KEY_LOGIN = 'login_code'
const SESSION_SECRET = process.env.ADMIN_CENTER_SESSION_SECRET || 'change-me-in-production'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
}

function createSignedCookie(exp: number): string {
  const payload = JSON.stringify({ exp })
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = signPayload(encoded)
  return `${encoded}.${sig}`
}

function verifySignedCookie(value: string): boolean {
  const parts = value.split('.')
  if (parts.length !== 2) return false
  const [encoded, sig] = parts
  if (!encoded || !sig) return false
  const expectedSig = signPayload(encoded)
  if (sig !== expectedSig) return false
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000
  } catch {
    return false
  }
}

/** Returns current user email if authenticated; used to show Keys button only to admin email. */
export async function getCurrentUserEmail(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email ?? null
}

/** Get admin login code. Only allowed when current user is waswaswas28@gmail.com. */
export async function getAdminCode(): Promise<{ code: string; updated_at: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return { error: 'Unauthorized' }
  }
  const admin = createAdminClient()
  if (!admin) return { error: getAdminConfigError() ?? 'Cannot generate code: server configuration missing.' }
  const { data, error } = await admin
    .from('admin_center_config')
    .select('value')
    .eq('key', CONFIG_KEY_LOGIN)
    .maybeSingle()
  if (error) return { error: error.message }
  const value = data?.value as { code?: string; updated_at?: string } | null
  if (value?.code) {
    return { code: value.code, updated_at: value.updated_at || '' }
  }
  const code = generateCode()
  const updated_at = new Date().toISOString()
  const { error: upsertError } = await admin
    .from('admin_center_config')
    .upsert({ key: CONFIG_KEY_LOGIN, value: { code, updated_at } }, { onConflict: 'key' })
  if (upsertError) return { error: upsertError.message }
  return { code, updated_at }
}

/** Regenerate admin login code. Only allowed when current user is waswaswas28@gmail.com. */
export async function regenerateAdminCode(): Promise<{ code: string; updated_at: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return { error: 'Unauthorized' }
  }
  const admin = createAdminClient()
  if (!admin) return { error: getAdminConfigError() ?? 'Cannot generate code: server configuration missing.' }
  const code = generateCode()
  const updated_at = new Date().toISOString()
  const { error } = await admin
    .from('admin_center_config')
    .upsert({ key: CONFIG_KEY_LOGIN, value: { code, updated_at } }, { onConflict: 'key' })
  if (error) return { error: error.message }
  return { code, updated_at }
}

/** Validate code and set admin session cookie. */
export async function validateAdminCode(code: string): Promise<{ success: true } | { error: string }> {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return { error: 'Enter the access code' }
  const admin = createAdminClient()
  if (!admin) return { error: getAdminConfigError() ?? 'Admin login is not configured.' }
  const { data, error } = await admin
    .from('admin_center_config')
    .select('value')
    .eq('key', CONFIG_KEY_LOGIN)
    .maybeSingle()
  if (error) return { error: error.message }
  const value = data?.value as { code?: string } | null
  const stored = value?.code?.toUpperCase().trim()
  if (!stored || stored !== trimmed) return { error: 'Invalid code' }
  const exp = Math.floor(Date.now() / 1000) + ADMIN_COOKIE_MAX_AGE
  const cookieValue = createSignedCookie(exp)
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: '/admincenter',
  })
  return { success: true }
}

/** Check if current request has valid admin session. */
export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const value = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!value) return false
  return verifySignedCookie(value)
}

/** Clear admin session and redirect to admin login. */
export async function adminLogout(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_COOKIE_NAME)
  redirect('/admincenter')
}

/** Require admin session; redirect to admin login if not valid. */
export async function requireAdminSession(): Promise<void> {
  const ok = await getAdminSession()
  if (!ok) redirect('/admincenter')
}

function requireAdminClient() {
  const admin = createAdminClient()
  if (!admin) throw new Error(getAdminConfigError() ?? 'Admin configuration missing.')
  return admin
}

/** List all organizations with invite code from settings. */
export async function adminListOrganizations(): Promise<
  { id: string; name: string; invite_code: string | null; invite_code_expires_at: string | null }[]
> {
  await requireAdminSession()
  const admin = requireAdminClient()
  const { data, error } = await admin
    .from('organizations')
    .select('id, name, settings')
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  return (data || []).map((row: any) => {
    const settings = row.settings || {}
    return {
      id: row.id,
      name: row.name,
      invite_code: settings.invitation_code ?? null,
      invite_code_expires_at: settings.invitation_code_expires_at ?? null,
    }
  })
}

/** List all users (auth) and their org memberships. */
export async function adminListUsers(): Promise<
  {
    id: string
    email: string | null
    created_at: string
    banned: boolean
    banned_reason: string | null
    orgs: { organization_id: string; organization_name: string; role: string }[]
  }[]
> {
  await requireAdminSession()
  const admin = requireAdminClient()
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (usersError) throw new Error(usersError.message)
  const { data: members } = await admin
    .from('organization_members')
    .select('user_id, organization_id, role')
    .eq('is_active', true)
  const { data: orgs } = await admin.from('organizations').select('id, name')
  const orgMap = new Map((orgs || []).map((o: any) => [o.id, o.name]))
  const membersByUser = new Map<string, { organization_id: string; organization_name: string; role: string }[]>()
  for (const m of members || []) {
    const list = membersByUser.get(m.user_id) || []
    list.push({
      organization_id: m.organization_id,
      organization_name: orgMap.get(m.organization_id) || m.organization_id,
      role: m.role,
    })
    membersByUser.set(m.user_id, list)
  }
  const meta = (u: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }) => {
    const app = u.app_metadata || {}
    return {
      banned: !!app.banned,
      banned_reason: (app.banned_reason as string) || null,
    }
  }
  return (users?.users || []).map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    ...meta(u),
    orgs: membersByUser.get(u.id) || [],
  }))
}

/** Impersonate: generate magic link for user and return URL. */
export async function adminImpersonate(userId: string): Promise<{ url: string } | { error: string }> {
  await requireAdminSession()
  const admin = requireAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://gms.hostado.net')
  const { data: user } = await admin.auth.admin.getUserById(userId)
  if (!user?.user?.email) return { error: 'User not found or has no email' }
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.user.email,
    options: { redirectTo: `${appUrl}/dashboard` },
  })
  if (linkError) return { error: linkError.message }
  const url = (linkData as any)?.properties?.action_link ?? (linkData as any)?.action_link
  if (!url) return { error: 'Failed to generate magic link' }
  return { url }
}

/** Update user email (admin). */
export async function adminUpdateUserEmail(userId: string, newEmail: string): Promise<{ success: true } | { error: string }> {
  await requireAdminSession()
  const admin = requireAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { email: newEmail })
  if (error) return { error: error.message }
  return { success: true }
}

/** Update user password (admin). */
export async function adminUpdateUserPassword(userId: string, newPassword: string): Promise<{ success: true } | { error: string }> {
  await requireAdminSession()
  const admin = requireAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return { error: error.message }
  return { success: true }
}

/** Ban user with reason (stored in app_metadata). */
export async function adminBanUser(userId: string, reason: string): Promise<{ success: true } | { error: string }> {
  await requireAdminSession()
  const admin = requireAdminClient()
  const { data: user } = await admin.auth.admin.getUserById(userId)
  if (!user?.user) return { error: 'User not found' }
  const app_metadata = { ...(user.user.app_metadata || {}), banned: true, banned_reason: reason, banned_at: new Date().toISOString() }
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata })
  if (error) return { error: error.message }
  return { success: true }
}

/** Unban user. */
export async function adminUnbanUser(userId: string): Promise<{ success: true } | { error: string }> {
  await requireAdminSession()
  const admin = requireAdminClient()
  const { data: user } = await admin.auth.admin.getUserById(userId)
  if (!user?.user) return { error: 'User not found' }
  const app_metadata = { ...(user.user.app_metadata || {}) }
  delete app_metadata.banned
  delete app_metadata.banned_reason
  delete app_metadata.banned_at
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata })
  if (error) return { error: error.message }
  return { success: true }
}

/** Unassign user from an organization (set is_active = false or delete membership). */
export async function adminUnassignFromOrg(userId: string, organizationId: string): Promise<{ success: true } | { error: string }> {
  await requireAdminSession()
  const admin = requireAdminClient()
  const { error } = await admin
    .from('organization_members')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
  if (error) return { error: error.message }
  return { success: true }
}
