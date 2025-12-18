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

    redirect('/dashboard')
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



