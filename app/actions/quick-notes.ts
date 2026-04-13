'use server'

import { createClient } from '@/lib/supabase/server'
import type { UserQuickNote } from '@/types/database'

export async function getQuickNotes(): Promise<UserQuickNote[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_quick_notes')
    .select('id, user_id, content, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      return []
    }
    console.error('getQuickNotes:', error.message)
    return []
  }
  return (data || []) as UserQuickNote[]
}

export async function createQuickNote(content: string): Promise<UserQuickNote> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const trimmed = content.trim()
  if (!trimmed) throw new Error('Note cannot be empty.')

  const { data, error } = await supabase
    .from('user_quick_notes')
    .insert({ user_id: user.id, content: trimmed })
    .select('id, user_id, content, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  return data as UserQuickNote
}

export async function updateQuickNote(id: string, content: string): Promise<UserQuickNote> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const trimmed = content.trim()
  if (!trimmed) throw new Error('Note cannot be empty.')

  const { data, error } = await supabase
    .from('user_quick_notes')
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, user_id, content, created_at, updated_at')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Note not found or access denied.')
  return data as UserQuickNote
}

export async function deleteQuickNote(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('user_quick_notes').delete().eq('id', id).eq('user_id', user.id)

  if (error) throw new Error(error.message)
}
