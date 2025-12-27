'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Feedback {
  id: string
  created_at: string
  updated_at: string
  owner_id: string
  note: string
  priority?: string | null
  completed?: boolean
}

export async function createFeedback(data: {
  note: string
  priority?: string
}): Promise<Feedback> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: feedback, error } = await supabase
    .from('feedback')
    .insert({
      owner_id: user.id,
      note: data.note,
      priority: data.priority || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  return feedback as Feedback
}

export async function getFeedback(): Promise<Feedback[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    // If table doesn't exist, return empty array
    if (error.message.includes('does not exist') || 
        error.message.includes('relation') || 
        error.message.includes('Could not find the table')) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []) as Feedback[]
}

export async function updateFeedback(
  id: string,
  data: {
    note?: string
    priority?: string | null
    completed?: boolean
  }
): Promise<Feedback> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: feedback, error } = await supabase
    .from('feedback')
    .update(data)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  return feedback as Feedback
}

export async function deleteFeedback(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('feedback')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
}

export async function toggleFeedbackCompleted(id: string, completed: boolean): Promise<Feedback> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: feedback, error } = await supabase
    .from('feedback')
    .update({ completed })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  return feedback as Feedback
}






