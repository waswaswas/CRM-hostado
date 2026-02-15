import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Handles redirect from Supabase after magic link (e.g. impersonation) or OAuth.
 * Supports:
 * - ?code=... (PKCE): exchangeCodeForSession
 * - ?token_hash=...&type=magiclink: verifyOtp (direct impersonation link, no Supabase confirmation page)
 * Add this URL to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
 *   http://localhost:3000/auth/callback, https://gms.hostado.net/auth/callback
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') || 'magiclink'
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  const supabase = await createClient()

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: type as 'magiclink', token_hash: tokenHash })
    if (error) {
      console.error('Auth callback verifyOtp error:', error)
      return NextResponse.redirect(new URL('/login?error=callback', requestUrl.origin))
    }
    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Auth callback exchange error:', error)
      return NextResponse.redirect(new URL('/login?error=callback', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
