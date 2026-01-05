import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase is not configured, allow access to setup page only
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    if (request.nextUrl.pathname !== '/setup' && !request.nextUrl.pathname.startsWith('/_next')) {
      const url = request.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  let user = null
  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            supabaseResponse = NextResponse.next({
              request,
            })
            supabaseResponse.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            supabaseResponse = NextResponse.next({
              request,
            })
            supabaseResponse.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  } catch (error) {
    // If there's an error, allow access to setup page
    console.error('Error in middleware:', error)
    if (request.nextUrl.pathname !== '/setup' && !request.nextUrl.pathname.startsWith('/_next')) {
      const url = request.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/setup') &&
    !request.nextUrl.pathname.startsWith('/join-organization') &&
    !request.nextUrl.pathname.startsWith('/_next')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users from login/signup pages
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    // Check if user has organizations
    try {
      const supabase = createServerClient(
        supabaseUrl!,
        supabaseAnonKey!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set() {},
            remove() {},
          },
        }
      )
      const { data: members } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)

      // If user has no organizations, redirect to join/create page
      if (!members || members.length === 0) {
        const url = request.nextUrl.clone()
        url.pathname = '/join-organization'
        return NextResponse.redirect(url)
      }
    } catch (error) {
      // If check fails, redirect to join-organization to be safe
      console.error('Error checking organizations:', error)
      const url = request.nextUrl.clone()
      url.pathname = '/join-organization'
      return NextResponse.redirect(url)
    }
    
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users trying to access dashboard without organizations
  if (user && request.nextUrl.pathname === '/dashboard') {
    try {
      const supabase = createServerClient(
        supabaseUrl!,
        supabaseAnonKey!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set() {},
            remove() {},
          },
        }
      )
      const { data: members } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)

      // If user has no organizations, redirect to join/create page
      if (!members || members.length === 0) {
        const url = request.nextUrl.clone()
        url.pathname = '/join-organization'
        return NextResponse.redirect(url)
      }
    } catch (error) {
      // If check fails, allow access (dashboard will handle it)
      console.error('Error checking organizations in middleware:', error)
    }
  }

  return supabaseResponse
}



