'use server'

import { createClient } from '@/lib/supabase/server'
import type { Account } from '@/types/database'
import { revalidatePath } from 'next/cache'

export async function getAccounts(): Promise<Account[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('owner_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching accounts:', error)
    // Check if table doesn't exist
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      throw new Error('Accounts table does not exist. Please run the migration: supabase/migration_accounting.sql')
    }
    // Check if RLS is blocking
    if (error.message?.includes('permission denied') || error.code === '42501') {
      throw new Error('Permission denied. Please check RLS policies for accounts table.')
    }
    throw new Error(`Failed to fetch accounts: ${error.message || error.code || 'Unknown error'}`)
  }

  return data || []
}

export async function getAccount(id: string): Promise<Account | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching account:', error)
    return null
  }

  return data
}

export async function createAccount(data: {
  name: string
  account_number?: string
  bank_name?: string
  bank_phone?: string
  type?: 'bank' | 'cash' | 'credit_card' | 'other'
  currency?: string
  opening_balance?: number
  notes?: string
}): Promise<Account> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: account, error } = await supabase
    .from('accounts')
    .insert({
      owner_id: user.id,
      name: data.name,
      account_number: data.account_number || null,
      bank_name: data.bank_name || null,
      bank_phone: data.bank_phone || null,
      type: data.type || 'bank',
      currency: data.currency || 'BGN',
      opening_balance: data.opening_balance || 0,
      current_balance: data.opening_balance || 0,
      notes: data.notes || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating account:', error)
    throw new Error('Failed to create account')
  }

  revalidatePath('/accounting/accounts')
  return account
}

export async function updateAccount(
  id: string,
  data: {
    name?: string
    account_number?: string
    bank_name?: string
    bank_phone?: string
    type?: 'bank' | 'cash' | 'credit_card' | 'other'
    currency?: string
    opening_balance?: number
    notes?: string
  }
): Promise<Account> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.account_number !== undefined) updateData.account_number = data.account_number
  if (data.bank_name !== undefined) updateData.bank_name = data.bank_name
  if (data.bank_phone !== undefined) updateData.bank_phone = data.bank_phone
  if (data.type !== undefined) updateData.type = data.type
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.notes !== undefined) updateData.notes = data.notes

  // If opening_balance changes, adjust current_balance accordingly
  if (data.opening_balance !== undefined) {
    const { data: currentAccount } = await supabase
      .from('accounts')
      .select('opening_balance, current_balance')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single()

    if (currentAccount) {
      const balanceDiff = data.opening_balance - currentAccount.opening_balance
      updateData.opening_balance = data.opening_balance
      updateData.current_balance = currentAccount.current_balance + balanceDiff
    }
  }

  const { data: account, error } = await supabase
    .from('accounts')
    .update(updateData)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating account:', error)
    throw new Error('Failed to update account')
  }

  revalidatePath('/accounting/accounts')
  revalidatePath(`/accounting/accounts/${id}`)
  return account
}

export async function deleteAccount(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Check if account has transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id')
    .eq('account_id', id)
    .eq('owner_id', user.id)
    .limit(1)

  if (transactions && transactions.length > 0) {
    throw new Error('Cannot delete account with existing transactions')
  }

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('Error deleting account:', error)
    throw new Error('Failed to delete account')
  }

  revalidatePath('/accounting/accounts')
}















