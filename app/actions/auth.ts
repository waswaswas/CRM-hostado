'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(email: string, password: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    redirect('/dashboard')
  } catch (error) {
    if (error instanceof Error && error.message.includes('Supabase is not configured')) {
      throw new Error('Please configure Supabase in your .env.local file. See README.md for instructions.')
    }
    throw error
  }
}

export async function signUp(email: string, password: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    // Always redirect to join-organization for new signups
    // The dashboard will check and redirect if needed, but this ensures
    // new users always see the join/create page first
    redirect('/join-organization')
  } catch (error) {
    if (error instanceof Error && error.message.includes('Supabase is not configured')) {
      throw new Error('Please configure Supabase in your .env.local file. See README.md for instructions.')
    }
    throw error
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(email: string) {
  try {
    const supabase = await createClient()
    
    // Get the app URL from environment or construct it
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                   typeof window !== 'undefined' ? window.location.origin :
                   'https://gms.hostado.net'
    
    const redirectTo = `${appUrl}/auth/reset-password`
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      throw new Error(error.message)
    }

    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Supabase is not configured')) {
      throw new Error('Please configure Supabase in your environment variables.')
    }
    throw error
  }
}



