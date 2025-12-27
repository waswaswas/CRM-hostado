'use server'

import { createClient } from '@/lib/supabase/server'
import type { Transaction, TransactionWithRelations } from '@/types/database'
import { revalidatePath } from 'next/cache'

export async function getTransactions(filters?: {
  account_id?: string
  type?: 'income' | 'expense' | 'transfer'
  category?: string
  start_date?: string
  end_date?: string
  contact_id?: string
  accounting_customer_id?: string
}): Promise<TransactionWithRelations[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // First check if table exists by trying a simple query
  const { error: tableCheckError } = await supabase
    .from('transactions')
    .select('id')
    .limit(1)

  if (tableCheckError) {
    if (tableCheckError.message?.includes('relation') && tableCheckError.message?.includes('does not exist')) {
      throw new Error('Transactions table does not exist. Please run the migration: supabase/migration_accounting.sql')
    }
    if (tableCheckError.message?.includes('permission denied') || tableCheckError.code === '42501') {
      throw new Error('Permission denied. Please check RLS policies for transactions table.')
    }
    // Re-throw other errors
    throw new Error(`Database error: ${tableCheckError.message || tableCheckError.code || 'Unknown error'}`)
  }

  // Try with foreign key relationships first
  let query = supabase
    .from('transactions')
    .select(`
      *,
      account:accounts(*),
      contact:clients(*),
      accounting_customer:accounting_customers(*)
    `)
    .eq('owner_id', user.id)

  if (filters?.account_id) {
    query = query.eq('account_id', filters.account_id)
  }

  if (filters?.type) {
    query = query.eq('type', filters.type)
  }

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.start_date) {
    query = query.gte('date', filters.start_date)
  }

  if (filters?.end_date) {
    query = query.lte('date', filters.end_date)
  }

  if (filters?.contact_id) {
    query = query.eq('contact_id', filters.contact_id)
  }

  if (filters?.accounting_customer_id) {
    query = query.eq('accounting_customer_id', filters.accounting_customer_id)
  }

  let { data, error } = await query.order('date', { ascending: false }).order('created_at', { ascending: false })

  // If foreign key relationships fail, try without them
  if (error && (error.message?.includes('foreign key') || error.message?.includes('relation') || error.code === '42P01')) {
    console.warn('Foreign key relationships failed, trying without them:', error.message)
    // Fallback: fetch transactions without foreign key relationships
    const { data: simpleData, error: simpleError } = await supabase
      .from('transactions')
      .select('*')
      .eq('owner_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (simpleError) {
      console.error('Error fetching transactions (simple query):', simpleError)
      if (simpleError.message?.includes('relation') && simpleError.message?.includes('does not exist')) {
        throw new Error('Transactions table does not exist. Please run the migration: supabase/migration_accounting.sql')
      }
      if (simpleError.message?.includes('permission denied') || simpleError.code === '42501') {
        throw new Error('Permission denied. Please check RLS policies for transactions table.')
      }
      throw new Error(`Failed to fetch transactions: ${simpleError.message || simpleError.code || 'Unknown error'}`)
    }

    // Manually fetch related accounts and clients
    const accountIds = [...new Set(simpleData?.map((t: any) => t.account_id).filter(Boolean) || [])]
    const contactIds = [...new Set(simpleData?.map((t: any) => t.contact_id).filter(Boolean) || [])]

    const accountsMap = new Map()
    const contactsMap = new Map()

    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .in('id', accountIds)
        .eq('owner_id', user.id)

      accounts?.forEach((acc: any) => accountsMap.set(acc.id, acc))
    }

    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('clients')
        .select('*')
        .in('id', contactIds)

      contacts?.forEach((client: any) => contactsMap.set(client.id, client))
    }

    // Combine data
    data = simpleData?.map((t: any) => ({
      ...t,
      account: accountsMap.get(t.account_id),
      contact: contactsMap.get(t.contact_id),
    }))
  } else if (error) {
    console.error('Error fetching transactions:', error)
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      throw new Error('Transactions table does not exist. Please run the migration: supabase/migration_accounting.sql')
    }
    if (error.message?.includes('permission denied') || error.code === '42501') {
      throw new Error('Permission denied. Please check RLS policies for transactions table.')
    }
    throw new Error(`Failed to fetch transactions: ${error.message || error.code || 'Unknown error'}`)
  }

  return data || []
}

export async function getTransaction(id: string): Promise<TransactionWithRelations | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      account:accounts(*),
      contact:clients(*)
    `)
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching transaction:', error)
    return null
  }

  return data
}

async function generateTransactionNumber(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get the highest transaction number
  const { data: lastTransaction } = await supabase
    .from('transactions')
    .select('number')
    .eq('owner_id', user.id)
    .like('number', 'TRA-%')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNumber = 1
  if (lastTransaction?.number) {
    const match = lastTransaction.number.match(/TRA-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `TRA-${String(nextNumber).padStart(5, '0')}`
}

export async function createTransaction(data: {
  account_id: string
  type: 'income' | 'expense' | 'transfer'
  date: string
  amount: number
  currency?: string
  category?: string
  payment_method?: string
  description?: string
  reference?: string
  contact_id?: string
  accounting_customer_id?: string
  number?: string
  transfer_to_account_id?: string
}): Promise<Transaction> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const transactionNumber = data.number || await generateTransactionNumber()

  // For transfer transactions, we need to create two linked transactions
  if (data.type === 'transfer' && data.transfer_to_account_id) {
    // Create the "from" transaction (expense)
    const { data: fromTransaction, error: fromError } = await supabase
      .from('transactions')
      .insert({
        owner_id: user.id,
        account_id: data.account_id,
        type: 'expense',
        number: transactionNumber,
        date: data.date,
        amount: data.amount,
        currency: data.currency || 'BGN',
        category: 'Transfer',
        payment_method: data.payment_method || 'cash',
        description: data.description || null,
        reference: data.reference || null,
        contact_id: data.contact_id || null,
        accounting_customer_id: data.accounting_customer_id || null,
        transfer_to_account_id: data.transfer_to_account_id,
        created_by: user.id,
      })
      .select()
      .single()

    if (fromError) {
      console.error('Error creating transfer (from):', fromError)
      throw new Error('Failed to create transfer transaction')
    }

    // Create the "to" transaction (income)
    const toNumber = await generateTransactionNumber()
    const { data: toTransaction, error: toError } = await supabase
      .from('transactions')
      .insert({
        owner_id: user.id,
        account_id: data.transfer_to_account_id,
        type: 'income',
        number: toNumber,
        date: data.date,
        amount: data.amount,
        currency: data.currency || 'BGN',
        category: 'Transfer',
        payment_method: data.payment_method || 'cash',
        description: data.description || null,
        reference: data.reference || null,
        contact_id: data.contact_id || null,
        accounting_customer_id: data.accounting_customer_id || null,
        transfer_transaction_id: fromTransaction.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (toError) {
      // Rollback: delete the from transaction
      await supabase.from('transactions').delete().eq('id', fromTransaction.id)
      console.error('Error creating transfer (to):', toError)
      throw new Error('Failed to create transfer transaction')
    }

    // Update the from transaction with the link to the to transaction
    await supabase
      .from('transactions')
      .update({ transfer_transaction_id: toTransaction.id })
      .eq('id', fromTransaction.id)

    revalidatePath('/accounting/transactions')
    return fromTransaction
  }

  // Regular income or expense transaction
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      owner_id: user.id,
      account_id: data.account_id,
      type: data.type,
      number: transactionNumber,
      date: data.date,
      amount: data.amount,
      currency: data.currency || 'BGN',
      category: data.category || null,
      payment_method: data.payment_method || 'cash',
      description: data.description || null,
      reference: data.reference || null,
      contact_id: data.contact_id || null,
      accounting_customer_id: data.accounting_customer_id || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating transaction:', error)
    throw new Error('Failed to create transaction')
  }

  revalidatePath('/accounting/transactions')
  return transaction
}

export async function updateTransaction(
  id: string,
  data: {
    account_id?: string
    type?: 'income' | 'expense' | 'transfer'
    date?: string
    amount?: number
    currency?: string
    category?: string
    payment_method?: string
    description?: string
    reference?: string
    contact_id?: string
  }
): Promise<Transaction> {
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

  if (data.account_id !== undefined) updateData.account_id = data.account_id
  if (data.type !== undefined) updateData.type = data.type
  if (data.date !== undefined) updateData.date = data.date
  if (data.amount !== undefined) updateData.amount = data.amount
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.category !== undefined) updateData.category = data.category
  if (data.payment_method !== undefined) updateData.payment_method = data.payment_method
  if (data.description !== undefined) updateData.description = data.description
  if (data.reference !== undefined) updateData.reference = data.reference
  if (data.contact_id !== undefined) updateData.contact_id = data.contact_id

  const { data: transaction, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating transaction:', error)
    throw new Error('Failed to update transaction')
  }

  revalidatePath('/accounting/transactions')
  revalidatePath(`/accounting/transactions/${id}`)
  return transaction
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // If this is a transfer transaction, delete the linked transaction too
  const { data: transaction } = await supabase
    .from('transactions')
    .select('transfer_transaction_id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (transaction?.transfer_transaction_id) {
    await supabase
      .from('transactions')
      .delete()
      .eq('id', transaction.transfer_transaction_id)
      .eq('owner_id', user.id)
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    console.error('Error deleting transaction:', error)
    throw new Error('Failed to delete transaction')
  }

  revalidatePath('/accounting/transactions')
}
