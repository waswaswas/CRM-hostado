'use server'

import { createClient } from '@/lib/supabase/server'
import { Client, ClientStatus } from '@/types/database'
import { revalidatePath } from 'next/cache'

export async function createClientRecord(data: {
  name: string
  company?: string
  email?: string
  phone?: string
  status?: ClientStatus
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

  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      ...data,
      owner_id: user.id,
      status: data.status || 'new',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
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

  const { data: client, error } = await supabase
    .from('clients')
    .update(data)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
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

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(error.message)
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

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      // Check if it's a table not found error
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        throw new Error('Database tables not found. Please run the SQL schema from supabase/schema.sql in your Supabase SQL Editor.')
      }
      throw new Error(error.message)
    }

    return data || []
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

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
