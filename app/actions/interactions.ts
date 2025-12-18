'use server'

import { createClient } from '@/lib/supabase/server'
import { Interaction, InteractionType, InteractionDirection } from '@/types/database'
import { revalidatePath } from 'next/cache'

export async function createInteraction(data: {
  client_id: string
  type: InteractionType
  direction?: InteractionDirection
  date: string
  duration_minutes?: number
  subject: string
  notes?: string
  email_id?: string
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

  const { data: interaction, error } = await supabase
    .from('interactions')
    .insert({
      ...data,
      date: new Date(data.date).toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${data.client_id}`)
  return interaction
}

export async function getInteractionsForClient(clientId: string) {
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
    .from('interactions')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function deleteInteraction(id: string, clientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('interactions')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/clients/${clientId}`)
}



