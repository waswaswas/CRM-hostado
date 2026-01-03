import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url.includes('placeholder')) {
    // In production, try to redirect to setup page instead of crashing
    if (typeof window !== 'undefined' && window.location.pathname !== '/setup') {
      console.error('Supabase is not configured. Redirecting to setup page.')
      window.location.href = '/setup'
      // Return a minimal mock to prevent immediate crashes
      return {
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
          signOut: async () => ({ error: null }),
        },
      } as any
    }
    throw new Error(
      'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.'
    )
  }

  return createBrowserClient(url, key)
}



