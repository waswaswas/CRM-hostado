import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Auth callback page: handles magic link / impersonation.
 * Supports ?token_hash=...&type=magiclink and ?code=... (PKCE).
 * Served as a page so it is included in all builds (avoids 404 on some hosts).
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const code = typeof params?.code === 'string' ? params.code : null
  const tokenHash = typeof params?.token_hash === 'string' ? params.token_hash : null
  const type = (typeof params?.type === 'string' ? params.type : 'magiclink') as 'magiclink'
  const next = typeof params?.next === 'string' ? params.next : '/dashboard'

  const supabase = await createClient()

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      console.error('Auth callback verifyOtp error:', error)
      redirect('/login?error=callback')
    }
    redirect(next)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Auth callback exchange error:', error)
      redirect('/login?error=callback')
    }
  }

  redirect(next)
}
