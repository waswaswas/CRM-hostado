'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId } from './organizations'

const FEEDBACK_ADMIN_EMAIL = 'waswaswas28@gmail.com'

export type FeedbackStatus = 'pending' | 'working_on' | 'done' | 'info_needed' | 'test_needed'

export interface Feedback {
  id: string
  created_at: string
  updated_at: string
  owner_id: string
  note: string
  priority?: string | null
  completed?: boolean
  status?: FeedbackStatus | null
  owner_email?: string
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

  const organizationId = await getCurrentOrganizationId()

  const { data: feedback, error } = await supabase
    .from('feedback')
    .insert({
      owner_id: user.id,
      note: data.note,
      priority: data.priority || null,
      organization_id: organizationId,
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

  const isFeedbackAdmin = user.email === FEEDBACK_ADMIN_EMAIL

  const query = supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  if (isFeedbackAdmin) {
    // Application-wide: admin sees all feedback
  } else {
    // User-scoped: show all feedback submitted by this user, regardless of organization
    query.eq('owner_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    if (error.message.includes('does not exist') ||
        error.message.includes('relation') ||
        error.message.includes('Could not find the table')) {
      return []
    }
    throw new Error(error.message)
  }

  const entries = (data || []) as Feedback[]
  const ownerIds = Array.from(new Set(entries.map((e) => e.owner_id)))
  const ownerEmailsMap = new Map<string, string>()
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', ownerIds)
    profiles?.forEach((p: { id: string; email: string }) => ownerEmailsMap.set(p.id, p.email))
  }
  return entries.map((e) => ({
    ...e,
    owner_email: ownerEmailsMap.get(e.owner_id),
  }))
}

export async function getFeedbackViewMeta(): Promise<{ isFeedbackAdmin: boolean; userId: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { isFeedbackAdmin: false, userId: null }
  return {
    isFeedbackAdmin: user.email === FEEDBACK_ADMIN_EMAIL,
    userId: user.id,
  }
}

export async function updateFeedback(
  id: string,
  data: {
    note?: string
    priority?: string | null
    completed?: boolean
    status?: FeedbackStatus | null
  }
): Promise<Feedback> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const isFeedbackAdmin = user.email === FEEDBACK_ADMIN_EMAIL
  const query = supabase.from('feedback').update(data).eq('id', id)
  if (!isFeedbackAdmin) {
    query.eq('owner_id', user.id)
  }

  const { data: feedback, error } = await query.select().single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  return feedback as Feedback
}

export interface FeedbackComment {
  id: string
  feedback_id: string
  user_id: string
  content: string
  created_at: string
  user_email?: string
}

/** Returns comment counts for each feedback ID. Used to show counts without loading full comments. */
export async function getFeedbackCommentCounts(feedbackIds: string[]): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || feedbackIds.length === 0) return {}

  const { data: rows, error } = await supabase
    .from('feedback_comments')
    .select('feedback_id')
    .in('feedback_id', feedbackIds)

  if (error) return {}

  const counts: Record<string, number> = {}
  for (const id of feedbackIds) counts[id] = 0
  for (const r of rows || []) {
    counts[r.feedback_id] = (counts[r.feedback_id] ?? 0) + 1
  }
  return counts
}

export async function getFeedbackComments(feedbackId: string): Promise<FeedbackComment[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: rows, error } = await supabase
    .from('feedback_comments')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })

  if (error || !rows?.length) return []

  const userIds = Array.from(new Set(rows.map((r: any) => r.user_id)))
  const { data: profiles } = await supabase.from('user_profiles').select('id, email').in('id', userIds)
  const emailMap = new Map<string, string>()
  profiles?.forEach((p: { id: string; email: string }) => emailMap.set(p.id, p.email))

  return rows.map((r: any) => ({
    ...r,
    user_email: emailMap.get(r.user_id),
  })) as FeedbackComment[]
}

export async function createFeedbackComment(feedbackId: string, content: string): Promise<FeedbackComment> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: comment, error } = await supabase
    .from('feedback_comments')
    .insert({ feedback_id: feedbackId, user_id: user.id, content: content.trim() })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
  return { ...comment, user_email: user.email } as FeedbackComment
}

export async function updateFeedbackComment(commentId: string, content: string): Promise<FeedbackComment> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const isFeedbackAdmin = user.email === FEEDBACK_ADMIN_EMAIL
  const query = supabase
    .from('feedback_comments')
    .update({ content: content.trim() })
    .eq('id', commentId)

  if (!isFeedbackAdmin) {
    query.eq('user_id', user.id)
  }

  const { data: comment, error } = await query.select().single()

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
  return { ...comment, user_email: user.email } as FeedbackComment
}

export async function deleteFeedbackComment(commentId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const isFeedbackAdmin = user.email === FEEDBACK_ADMIN_EMAIL
  const query = supabase.from('feedback_comments').delete().eq('id', commentId)

  if (!isFeedbackAdmin) {
    query.eq('user_id', user.id)
  }

  const { error } = await query

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function deleteFeedback(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const isFeedbackAdmin = user.email === FEEDBACK_ADMIN_EMAIL
  const query = supabase.from('feedback').delete().eq('id', id)
  if (!isFeedbackAdmin) {
    query.eq('owner_id', user.id)
  }

  const { error } = await query

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

  const isFeedbackAdmin = user.email === FEEDBACK_ADMIN_EMAIL
  const query = supabase.from('feedback').update({ completed, status: completed ? 'done' : 'pending' }).eq('id', id)
  if (!isFeedbackAdmin) {
    query.eq('owner_id', user.id)
  }

  const { data: feedback, error } = await query.select().single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  return feedback as Feedback
}
























