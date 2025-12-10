'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { StatusConfig, Settings } from '@/types/settings'

export async function getSettings() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (error) {
    // If settings don't exist, return defaults
    if (error.code === 'PGRST116') {
      return {
        new_tag_days: 14,
        custom_statuses: [],
      }
    }
    throw new Error(error.message)
  }

  return {
    new_tag_days: data.new_tag_days || 14,
    custom_statuses: (data.custom_statuses as StatusConfig[]) || [],
  }
}

export async function updateSettings(settings: Partial<Settings>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Check if settings exist
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (settings.new_tag_days !== undefined) {
    updateData.new_tag_days = settings.new_tag_days
  }

  if (settings.custom_statuses !== undefined) {
    updateData.custom_statuses = settings.custom_statuses
  }

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('settings')
      .update(updateData)
      .eq('owner_id', user.id)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    // Insert new
    const { error } = await supabase
      .from('settings')
      .insert({
        owner_id: user.id,
        ...updateData,
      })

    if (error) {
      throw new Error(error.message)
    }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function getStatusChangeHistory(clientId?: string, limit: number = 50) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  let query = supabase
    .from('status_change_history')
    .select(`
      *,
      clients:client_id (
        id,
        name
      ),
      changed_by_user:changed_by (
        id,
        email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query

  if (error) {
    if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
      return []
    }
    throw new Error(error.message)
  }

  return data || []
}

export async function logStatusChange(
  clientId: string,
  oldStatus: string | null,
  newStatus: string,
  changeType: 'manual' | 'automatic' = 'manual',
  notes?: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Don't throw - just skip logging if not authenticated
    return
  }

  const { error } = await supabase
    .from('status_change_history')
    .insert({
      client_id: clientId,
      changed_by: changeType === 'manual' ? user.id : null,
      old_status: oldStatus,
      new_status: newStatus,
      change_type: changeType,
      notes: notes,
    })

  if (error) {
    // Don't throw - logging failures shouldn't break the app
    console.error('Failed to log status change:', error)
  }
}

