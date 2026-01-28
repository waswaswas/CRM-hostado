'use server'

import { createClient } from '@/lib/supabase/server'
import { Client, ClientStatus } from '@/types/database'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId, getCurrentUserOrgRole } from './organizations'

export async function createClientRecord(data: {
  name: string
  company?: string
  email?: string
  phone?: string
  status?: ClientStatus
  client_type?: 'presales' | 'customer'
  source?: string
  notes_summary?: string
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

  const insertData: any = {
    ...data,
    owner_id: user.id,
    organization_id: organizationId,
    status: data.status || (data.client_type === 'customer' ? 'active' : 'contacted'), // Default status based on type
  }
  
  // Only include client_type if the column exists (handles migration period)
  if (data.client_type) {
    insertData.client_type = data.client_type
  }

  const { data: client, error } = await supabase
    .from('clients')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Log initial status when creating a client
  if (client && client.status) {
    try {
      const { logStatusChange } = await import('@/app/actions/settings')
      await logStatusChange(client.id, null, client.status, 'manual', 'Initial status on client creation')
    } catch (err) {
      // Don't fail if logging fails
      console.error('Failed to log initial status change:', err)
    }
  }

  revalidatePath('/clients')
  revalidatePath('/dashboard')
  return client
}

export async function updateClient(
  id: string,
  data: Partial<Omit<Client, 'id' | 'created_at' | 'owner_id'>>
) {
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

  // Get current client to check for status change
  const { data: currentClient } = await supabase
    .from('clients')
    .select('status')
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .eq('is_deleted', false)
    .single()

  const { data: client, error } = await supabase
    .from('clients')
    .update(data)
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .eq('is_deleted', false)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Log status change if status was updated
  if (data.status && currentClient && currentClient.status !== data.status) {
    try {
      const { logStatusChange } = await import('@/app/actions/settings')
      await logStatusChange(id, currentClient.status, data.status, 'manual', `Status changed from ${currentClient.status} to ${data.status}`)
    } catch (err) {
      // Don't fail if logging fails, but log the error
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Failed to log status change:', errorMessage)
      // Check if it's a table missing error
      if (errorMessage.includes('Could not find the table') || errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
        console.warn('status_change_history table does not exist. Please run: supabase/SETUP_SETTINGS_TABLES.sql')
      }
    }
  }

  revalidatePath(`/clients/${id}`)
  revalidatePath('/clients')
  revalidatePath('/dashboard')
  return client
}

export async function deleteClient(id: string) {
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

  // Only owners and admins can delete clients; viewers can view/edit but not delete
  const role = await getCurrentUserOrgRole()
  if (!role || (role !== 'owner' && role !== 'admin')) {
    throw new Error('Only owners and admins can delete clients.')
  }

  // Soft delete client to prevent recreation and preserve history
  const { data: updatedClient, error } = await supabase
    .from('clients')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .eq('is_deleted', false)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!updatedClient) {
    throw new Error('Client could not be deleted (not found or insufficient permissions).')
  }

  revalidatePath('/clients')
  revalidatePath('/dashboard')
}

export async function getClients() {
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

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) {
      // Check if it's a table not found error
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        throw new Error('Database tables not found. Please run the SQL schema from supabase/schema.sql in your Supabase SQL Editor.')
      }
      throw new Error(error.message)
    }

    const clients = data || []
    
    // Note: "New" is now a tag that automatically disappears after 14 days
    // No need to update status - the tag visibility is handled client-side
    // If a presales client has been "new" for 14+ days and status is still default,
    // we could auto-update to "attention_needed", but for now we'll just let the tag disappear

    return clients
  } catch (error) {
    // Re-throw with better message if it's our custom error
    if (error instanceof Error && error.message.includes('Database tables not found')) {
      throw error
    }
    // For other errors, wrap them
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch clients')
  }
}

export async function getClient(id: string) {
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

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .eq('is_deleted', false)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}



