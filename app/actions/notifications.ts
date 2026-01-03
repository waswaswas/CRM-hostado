'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type NotificationType = 'email' | 'reminder' | 'tag_removed' | 'other'

export interface Notification {
  id: string
  created_at: string
  owner_id: string
  type: NotificationType
  title: string
  message: string | null
  is_read: boolean
  read_at: string | null
  related_id: string | null
  related_type: string | null
  metadata: Record<string, any>
}

export async function createNotification(data: {
  type: NotificationType
  title: string
  message?: string
  related_id?: string
  related_type?: string
  metadata?: Record<string, any>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      owner_id: user.id,
      type: data.type,
      title: data.title,
      message: data.message || null,
      related_id: data.related_id || null,
      related_type: data.related_type || null,
      metadata: data.metadata || {},
      is_read: false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/notifications')
  revalidatePath('/dashboard')
  return notification
}

export async function getNotifications(limit: number = 50): Promise<Notification[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as Notification[]
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return 0
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('is_read', false)

  if (error) {
    return 0
  }

  return count || 0
}

export async function markNotificationAsRead(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function markNotificationAsUnread(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: false,
      read_at: null,
    })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function deleteNotification(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function markAllNotificationsAsRead() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('owner_id', user.id)
    .eq('is_read', false)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}






