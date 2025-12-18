'use server'

import { createClient } from '@/lib/supabase/server'
import { Reminder } from '@/types/database'
import { revalidatePath } from 'next/cache'

export async function createReminder(data: {
  client_id: string
  due_at: string
  title: string
  description?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Verify client ownership
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', data.client_id)
    .eq('owner_id', user.id)
    .single()

  if (!client) {
    throw new Error('Client not found')
  }

  const { data: reminder, error } = await supabase
    .from('reminders')
    .insert({
      ...data,
      due_at: new Date(data.due_at).toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${data.client_id}`)
  revalidatePath('/dashboard')
  return reminder
}

export async function getRemindersForClient(clientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  // Verify client ownership
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('owner_id', user.id)
    .single()

  if (!client) {
    return []
  }

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('client_id', clientId)
    .order('due_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function getUpcomingReminders() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return []
    }

    const now = new Date().toISOString()

    // First get all reminders for user's clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)

    if (clientsError) {
      // Check if it's a table not found error
      if (clientsError.message.includes('Could not find the table') || clientsError.message.includes('relation') || clientsError.message.includes('does not exist')) {
        return [] // Return empty array instead of throwing for reminders
      }
      throw new Error(clientsError.message)
    }

    if (!clients || clients.length === 0) {
      return []
    }

    const clientIds = clients.map((c) => c.id)

    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .in('client_id', clientIds)
      .eq('done', false)
      .order('due_at', { ascending: true })
      .limit(20)

    if (error) {
      // If reminders table doesn't exist, just return empty array
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        return []
      }
      throw new Error(error.message)
    }

    // Fetch client info for each reminder
    const { data: allClients } = await supabase
      .from('clients')
      .select('id, name, company')
      .in('id', clientIds)

    const clientsMap = new Map(allClients?.map(c => [c.id, c]) || [])

    // Attach client info to reminders
    const data = reminders?.map(reminder => ({
      ...reminder,
      clients: clientsMap.get(reminder.client_id) || null
    })) || []

    return data
  } catch (error) {
    // Return empty array on error to prevent breaking the dashboard
    return []
  }
}

export async function markReminderDone(id: string, clientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('reminders')
    .update({ done: true })
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/dashboard')
}

export async function deleteReminder(id: string, clientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/dashboard')
}



