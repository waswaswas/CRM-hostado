'use server'

import { createClient } from '@/lib/supabase/server'
import { ClientNote } from '@/types/database'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId } from './organizations'

export async function createNote(data: {
  client_id: string
  content: string
  pinned?: boolean
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

  // Verify client ownership
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

  const { data: note, error } = await supabase
    .from('client_notes')
    .insert({
      ...data,
      organization_id: organizationId,
      pinned: data.pinned || false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${data.client_id}`)
  return note
}

export async function getNotesForClient(clientId: string) {
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
    .from('client_notes')
    .select('*')
    .eq('client_id', clientId)
    .eq('organization_id', organizationId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function updateNote(id: string, clientId: string, content: string) {
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
    .from('client_notes')
    .update({ content })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${clientId}`)
}

export async function toggleNotePin(id: string, clientId: string, pinned: boolean) {
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
    .from('client_notes')
    .update({ pinned })
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${clientId}`)
}

export async function deleteNote(id: string, clientId: string) {
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
    .from('client_notes')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${clientId}`)
}



