'use server'

import { createClient } from '@/lib/supabase/server'
import { Reminder } from '@/types/database'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId } from './organizations'

export async function createReminder(data: {
  client_id: string | null
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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  // Verify client ownership if client_id is provided
  if (data.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', data.client_id)
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (!client) {
      throw new Error('Client not found')
    }
  }

  const { data: reminder, error } = await supabase
    .from('reminders')
    .insert({
      ...data,
      client_id: data.client_id || null,
      organization_id: organizationId,
      due_at: new Date(data.due_at).toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Create notification for new reminder
  if (reminder) {
    try {
      const { createNotification } = await import('./notifications')
      const dueDate = new Date(data.due_at)
      const now = new Date()
      const isOverdue = dueDate < now
      
      await createNotification({
        type: 'reminder',
        title: isOverdue ? 'Overdue reminder' : 'New reminder',
        message: `${reminder.title}${data.client_id ? ' (for client)' : ' (General)'}`,
        related_id: reminder.id,
        related_type: 'reminder',
        metadata: {
          due_at: data.due_at,
          client_id: data.client_id,
        },
      })
    } catch (error) {
      // Don't fail reminder creation if notification fails
      console.error('Failed to create notification for reminder:', error)
    }
  }

  if (data.client_id) {
    revalidatePath(`/clients/${data.client_id}`)
  }
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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return []
  }

  // Verify client ownership
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  if (!client) {
    return []
  }

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('client_id', clientId)
    .eq('organization_id', organizationId)
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

    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) {
      return []
    }

    const now = new Date().toISOString()

    // First get all reminders for user's clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)

    if (clientsError) {
      // Check if it's a table not found error
      if (clientsError.message.includes('Could not find the table') || clientsError.message.includes('relation') || clientsError.message.includes('does not exist')) {
        return [] // Return empty array instead of throwing for reminders
      }
      throw new Error(clientsError.message)
    }

    const clientIds = clients ? clients.map((c: { id: string }) => c.id) : []

    // Get reminders for user's clients AND general reminders (where client_id is null)
    // We'll fetch both types and combine them
    const remindersPromises = []
    
    // Get reminders for user's clients
    if (clientIds.length > 0) {
      remindersPromises.push(
        supabase
          .from('reminders')
          .select('*')
          .in('client_id', clientIds)
          .eq('organization_id', organizationId)
          .eq('done', false)
          .order('due_at', { ascending: true })
      )
    }
    
    // Get general reminders (where client_id is null)
    remindersPromises.push(
      supabase
        .from('reminders')
        .select('*')
        .is('client_id', null)
        .eq('organization_id', organizationId)
        .eq('done', false)
        .order('due_at', { ascending: true })
    )

    const results = await Promise.all(remindersPromises)
    
    // Combine all reminders and remove duplicates
    const allReminders = results.flatMap(result => result.data || [])
    const uniqueReminders = Array.from(
      new Map(allReminders.map(r => [r.id, r])).values()
    )
    
    // Sort by due_at and limit to 20
    const reminders = uniqueReminders
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      .slice(0, 20)
    
    const error = results.find(r => r.error)?.error

    if (error) {
      // If reminders table doesn't exist, just return empty array
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        return []
      }
      throw new Error(error.message)
    }

    // Fetch client info for each reminder (only for reminders with client_id)
    const reminderClientIds = reminders?.filter(r => r.client_id).map(r => r.client_id) || []
    
    let clientsMap = new Map()
    if (reminderClientIds.length > 0) {
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, name, company')
        .in('id', reminderClientIds)
        .eq('organization_id', organizationId)

      clientsMap = new Map(allClients?.map((c: { id: string; name?: string | null; company?: string | null }) => [c.id, c]) || [])
    }

    // Attach client info to reminders
    const data = reminders?.map(reminder => ({
      ...reminder,
      clients: reminder.client_id ? (clientsMap.get(reminder.client_id) || null) : null
    })) || []

    return data
  } catch (error) {
    // Return empty array on error to prevent breaking the dashboard
    return []
  }
}

export async function markReminderDone(id: string, clientId: string | null) {
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

  // Get reminder details before updating
  const { data: reminder } = await supabase
    .from('reminders')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  const { error } = await supabase
    .from('reminders')
    .update({ done: true })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  // Create notification for overdue reminder if it was overdue
  if (reminder) {
    const dueDate = new Date(reminder.due_at)
    const now = new Date()
    if (dueDate < now) {
      try {
        const { createNotification } = await import('./notifications')
        await createNotification({
          type: 'reminder',
          title: 'Reminder completed',
          message: `Reminder "${reminder.title}" has been marked as done`,
          related_id: reminder.id,
          related_type: 'reminder',
          metadata: {
            was_overdue: true,
            due_at: reminder.due_at,
          },
        })
      } catch (error) {
        console.error('Failed to create notification for reminder completion:', error)
      }
    }
  }

  if (clientId) {
    revalidatePath(`/clients/${clientId}`)
  }
  revalidatePath('/dashboard')
}

export async function unmarkReminderDone(id: string, clientId: string | null) {
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
    .from('reminders')
    .update({ done: false })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  if (clientId) {
    revalidatePath(`/clients/${clientId}`)
  }
  revalidatePath('/dashboard')
}

export async function getCompletedReminders() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return []
    }

    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) {
      return []
    }

    // First get all reminders for user's clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)

    if (clientsError) {
      if (clientsError.message.includes('Could not find the table') || clientsError.message.includes('relation') || clientsError.message.includes('does not exist')) {
        return []
      }
      throw new Error(clientsError.message)
    }

    const clientIds = clients ? clients.map((c: { id: string }) => c.id) : []

    // Get completed reminders for user's clients AND general reminders (where client_id is null)
    const remindersPromises = []
    
    // Get completed reminders for user's clients
    if (clientIds.length > 0) {
      remindersPromises.push(
        supabase
          .from('reminders')
          .select('*')
          .in('client_id', clientIds)
          .eq('organization_id', organizationId)
          .eq('done', true)
          .order('due_at', { ascending: false })
      )
    }
    
    // Get completed general reminders (where client_id is null)
    remindersPromises.push(
      supabase
        .from('reminders')
        .select('*')
        .is('client_id', null)
        .eq('organization_id', organizationId)
        .eq('done', true)
        .order('due_at', { ascending: false })
    )

    const results = await Promise.all(remindersPromises)
    
    // Combine all reminders and remove duplicates
    const allReminders = results.flatMap(result => result.data || [])
    const uniqueReminders = Array.from(
      new Map(allReminders.map(r => [r.id, r])).values()
    )
    
    // Sort by due_at descending (most recent first)
    const reminders = uniqueReminders
      .sort((a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime())
    
    const error = results.find(r => r.error)?.error

    if (error) {
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        return []
      }
      throw new Error(error.message)
    }

    // Fetch client info for each reminder (only for reminders with client_id)
    const reminderClientIds = reminders?.filter(r => r.client_id).map(r => r.client_id) || []
    
    let clientsMap = new Map()
    if (reminderClientIds.length > 0) {
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, name, company')
        .in('id', reminderClientIds)
        .eq('organization_id', organizationId)

      clientsMap = new Map(allClients?.map((c: { id: string; name?: string | null; company?: string | null }) => [c.id, c]) || [])
    }

    // Attach client info to reminders
    const data = reminders?.map(reminder => ({
      ...reminder,
      clients: reminder.client_id ? (clientsMap.get(reminder.client_id) || null) : null
    })) || []

    return data
  } catch (error) {
    return []
  }
}

export async function updateReminder(
  id: string,
  clientId: string | null,
  data: {
    due_at?: string
    title?: string
    description?: string
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const updateData: any = {}
  if (data.due_at) updateData.due_at = new Date(data.due_at).toISOString()
  if (data.title) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description || null
  
  // Update client_id if provided (can be null for general reminders)
  if (clientId !== undefined) {
    updateData.client_id = clientId
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  // Verify client ownership if clientId is provided
  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (!client) {
      throw new Error('Client not found')
    }
  }

  const { error } = await supabase
    .from('reminders')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  if (clientId) {
    revalidatePath(`/clients/${clientId}`)
  }
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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/dashboard')
}



