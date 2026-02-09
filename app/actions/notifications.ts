'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId } from './organizations'

export type NotificationType = 'email' | 'reminder' | 'tag_removed' | 'other' | 'task_assigned' | 'task_mention'

export interface NotificationPreferences {
  reminders_enabled: boolean
  reminders_include_completed: boolean
  contacts_enabled: boolean
  tasks_enabled: boolean
}

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

async function getPreferencesForUser(userId: string): Promise<NotificationPreferences | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (data) return data as NotificationPreferences
  return null
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      reminders_enabled: true,
      reminders_include_completed: true,
      contacts_enabled: true,
      tasks_enabled: true,
    }
  }
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (data) return data as NotificationPreferences
  return {
    reminders_enabled: true,
    reminders_include_completed: true,
    contacts_enabled: true,
    tasks_enabled: true,
  }
}

export async function updateNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const payload: Record<string, unknown> = {
    ...prefs,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: user.id, ...payload },
      { onConflict: 'user_id' }
    )

  if (error) throw new Error(error.message)
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function createNotification(data: {
  type: NotificationType
  title: string
  message?: string
  related_id?: string
  related_type?: string
  metadata?: Record<string, any>
  /** Override owner (e.g. for task_assigned to assignee) */
  owner_id?: string
  /** Override organization (required for task_mention/task_assigned when owner != current user) */
  organization_id?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  let organizationId = data.organization_id ?? (await getCurrentOrganizationId())
  const ownerId = data.owner_id ?? user.id

  let prefs: NotificationPreferences | null = null
  try {
    prefs = await getPreferencesForUser(ownerId)
  } catch {
    /* preferences table may not exist yet */
  }
  if (prefs) {
    if (data.type === 'reminder' && !prefs.reminders_enabled) return null as any
    if (data.type === 'reminder' && (data.metadata as any)?.is_completion && !prefs.reminders_include_completed) return null as any
    if (data.type === 'email' && !prefs.contacts_enabled) return null as any
    if ((data.type === 'task_assigned' || data.type === 'task_mention') && !prefs.tasks_enabled) return null as any
  }

  const isTaskNotificationForOther = (data.type === 'task_assigned' || data.type === 'task_mention') && ownerId !== user.id
  const orgId = organizationId ?? null

  if (isTaskNotificationForOther && orgId) {
    const { data: rpcData, error: rpcError } = await supabase.rpc('insert_task_notification_for_user', {
      p_owner_id: ownerId,
      p_organization_id: orgId,
      p_type: data.type,
      p_title: data.title,
      p_message: data.message || null,
      p_related_id: data.related_id || null,
      p_related_type: data.related_type || null,
      p_metadata: data.metadata || {},
    })
    if (rpcError) throw new Error(rpcError.message)
    revalidatePath('/notifications')
    revalidatePath('/dashboard')
    return rpcData as Notification
  }

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      owner_id: ownerId,
      organization_id: orgId,
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

  const organizationId = await getCurrentOrganizationId()
  // If no organization selected, return empty (notifications are scoped to org)
  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return 0
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)

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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: false,
      read_at: null,
    })
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)

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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)

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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .eq('is_read', false)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function deleteAllNotifications() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}




