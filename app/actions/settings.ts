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
    if (error.code === 'PGRST116' || error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
      // Table doesn't exist or no settings found - return defaults
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        console.warn('settings table does not exist. Please run the migration: supabase/SETUP_SETTINGS_TABLES.sql')
      }
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
    timezone: (data as any).timezone || 'Europe/Sofia', // Default to Sofia, Bulgaria
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
  const { data: existing, error: checkError } = await supabase
    .from('settings')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  // If table doesn't exist, throw a helpful error
  if (checkError && (checkError.message.includes('Could not find the table') || checkError.message.includes('relation') || checkError.message.includes('does not exist'))) {
    throw new Error('Settings table does not exist. Please run the migration: supabase/SETUP_SETTINGS_TABLES.sql in your Supabase SQL Editor.')
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (settings.new_tag_days !== undefined) {
    updateData.new_tag_days = settings.new_tag_days
  }

  if (settings.custom_statuses !== undefined) {
    updateData.custom_statuses = settings.custom_statuses
  }

  if ((settings as any).timezone !== undefined) {
    updateData.timezone = (settings as any).timezone
  }

  if (existing && !checkError) {
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

  // First, get the history entries
  let query = supabase
    .from('status_change_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data: historyData, error } = await query

  if (error) {
    if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
      console.warn('status_change_history table does not exist. Please run the migration: supabase/SETUP_SETTINGS_TABLES.sql')
      return []
    }
    throw new Error(error.message)
  }

  if (!historyData || historyData.length === 0) {
    return []
  }

  // Get client names
  const clientIds = Array.from(new Set(historyData.map(h => h.client_id)))
  const { data: clientsData } = await supabase
    .from('clients')
    .select('id, name')
    .in('id', clientIds)

  const clientsMap = new Map(clientsData?.map(c => [c.id, c]) || [])

  // Get user emails for changed_by from user_profiles table
  const userIds = Array.from(new Set(historyData.map(h => h.changed_by).filter(Boolean) as string[]))
  const userEmailsMap = new Map<string, string>()

  if (userIds.length > 0) {
    // Try to fetch from user_profiles table (if it exists)
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, email')
        .in('id', userIds)

      if (!profilesError && profilesData) {
        profilesData.forEach(profile => {
          userEmailsMap.set(profile.id, profile.email)
        })
      }
    } catch (error) {
      // Table might not exist, continue without user emails
      console.warn('Could not fetch user profiles:', error)
    }
  }

  // Combine the data
  return historyData.map(entry => ({
    ...entry,
    clients: clientsMap.get(entry.client_id) || null,
    changed_by_email: entry.changed_by ? (userEmailsMap.get(entry.changed_by) || null) : null,
  }))
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

  // Check if table exists first
  const { error: checkError } = await supabase
    .from('status_change_history')
    .select('id')
    .limit(1)

  if (checkError) {
    if (checkError.message.includes('Could not find the table') || checkError.message.includes('relation') || checkError.message.includes('does not exist')) {
      console.warn('status_change_history table does not exist. Please run: supabase/SETUP_SETTINGS_TABLES.sql')
      return
    }
  }

  const { error } = await supabase
    .from('status_change_history')
    .insert({
      client_id: clientId,
      changed_by: changeType === 'manual' ? user.id : null,
      old_status: oldStatus,
      new_status: newStatus,
      change_type: changeType,
      notes: notes || null,
    })

  if (error) {
    // Log the error but don't throw - logging failures shouldn't break the app
    console.error('Failed to log status change:', error)
    // If it's an RLS policy issue, provide helpful message
    if (error.message.includes('policy') || error.message.includes('permission')) {
      console.error('RLS policy issue. Make sure status_change_history table has proper RLS policies.')
    }
  }
}


