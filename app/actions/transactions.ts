'use server'

import { createClient } from '@/lib/supabase/server'
import type { Transaction, TransactionWithRelations } from '@/types/database'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId } from './organizations'

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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return []
  }

  // Try with foreign key relationships first
  let query = supabase
    .from('transactions')
    .select(`
      *,
      account:accounts(*),
      contact:clients(*),
      accounting_customer:accounting_customers!left(*)
    `)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)

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
    let fallbackQuery = supabase
      .from('transactions')
      .select('*')
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)

    // Apply the same filters to fallback query
    if (filters?.account_id) {
      fallbackQuery = fallbackQuery.eq('account_id', filters.account_id)
    }
    if (filters?.type) {
      fallbackQuery = fallbackQuery.eq('type', filters.type)
    }
    if (filters?.category) {
      fallbackQuery = fallbackQuery.eq('category', filters.category)
    }
    if (filters?.start_date) {
      fallbackQuery = fallbackQuery.gte('date', filters.start_date)
    }
    if (filters?.end_date) {
      fallbackQuery = fallbackQuery.lte('date', filters.end_date)
    }
    if (filters?.contact_id) {
      fallbackQuery = fallbackQuery.eq('contact_id', filters.contact_id)
    }
    if (filters?.accounting_customer_id) {
      fallbackQuery = fallbackQuery.eq('accounting_customer_id', filters.accounting_customer_id)
    }

    const { data: simpleData, error: simpleError } = await fallbackQuery
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

    // Manually fetch related accounts, clients, and accounting customers
    const accountIds = Array.from(new Set(simpleData?.map((t: any) => t.account_id).filter(Boolean) || []))
    const contactIds = Array.from(new Set(simpleData?.map((t: any) => t.contact_id).filter(Boolean) || []))
    const accountingCustomerIds = Array.from(new Set(simpleData?.map((t: any) => t.accounting_customer_id).filter(Boolean) || []))

    const accountsMap = new Map()
    const contactsMap = new Map()
    const accountingCustomersMap = new Map()

    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .in('id', accountIds)
        .eq('owner_id', user.id)
        .eq('organization_id', organizationId)

      accounts?.forEach((acc: any) => accountsMap.set(acc.id, acc))
    }

    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('clients')
        .select('*')
        .in('id', contactIds)
        .eq('organization_id', organizationId)

      contacts?.forEach((client: any) => contactsMap.set(client.id, client))
    }

    if (accountingCustomerIds.length > 0) {
      const { data: accountingCustomers } = await supabase
        .from('accounting_customers')
        .select('*')
        .in('id', accountingCustomerIds)
        .eq('owner_id', user.id)
        .eq('organization_id', organizationId)

      accountingCustomers?.forEach((customer: any) => accountingCustomersMap.set(customer.id, customer))
    }

    // Combine data
    data = simpleData?.map((t: any) => ({
      ...t,
      account: accountsMap.get(t.account_id),
      contact: contactsMap.get(t.contact_id),
      accounting_customer: accountingCustomersMap.get(t.accounting_customer_id),
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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return null
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
    .eq('organization_id', organizationId)
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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  // Get the highest transaction number
  const { data: lastTransaction } = await supabase
    .from('transactions')
    .select('number')
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
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
  attachment_url?: string
}): Promise<Transaction> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('Auth error:', authError)
    throw new Error(`Authentication error: ${authError.message}`)
  }

  if (!user) {
    throw new Error('Unauthorized - User not found')
  }

  if (!user.id) {
    throw new Error('Unauthorized - User ID not found')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  // Verify account ownership before creating transaction
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, owner_id')
    .eq('id', data.account_id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  if (accountError || !account) {
    throw new Error('Account not found or you do not have permission to use this account')
  }

  const transactionNumber = data.number || await generateTransactionNumber()

  // For transfer transactions, we need to create two linked transactions
  if (data.type === 'transfer' && data.transfer_to_account_id) {
    // Create the "from" transaction (expense)
    const { data: fromTransaction, error: fromError } = await supabase
      .from('transactions')
      .insert({
        owner_id: user.id,
        organization_id: organizationId,
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
        attachment_url: data.attachment_url || null,
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
        organization_id: organizationId,
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
        attachment_url: data.attachment_url || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (toError) {
      // Rollback: delete the from transaction
      await supabase.from('transactions').delete().eq('id', fromTransaction.id).eq('organization_id', organizationId)
      console.error('Error creating transfer (to):', toError)
      throw new Error('Failed to create transfer transaction')
    }

    // Update the from transaction with the link to the to transaction
    await supabase
      .from('transactions')
      .update({ transfer_transaction_id: toTransaction.id })
      .eq('id', fromTransaction.id)
      .eq('organization_id', organizationId)

    revalidatePath('/accounting/transactions')
    return fromTransaction
  }

  // Regular income or expense transaction
  // Prepare insert data
  const insertData = {
    owner_id: user.id,
    organization_id: organizationId,
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
    attachment_url: data.attachment_url || null,
    created_by: user.id,
  }

  // Verify auth context is correct
  const { data: { user: verifyUser } } = await supabase.auth.getUser()
  if (!verifyUser || verifyUser.id !== user.id) {
    console.error('Auth context mismatch:', { original: user.id, verified: verifyUser?.id })
    throw new Error('Authentication context mismatch. Please refresh the page and try again.')
  }

  console.log('Creating transaction with owner_id:', user.id)
  console.log('Insert data:', { ...insertData, attachment_url: insertData.attachment_url ? '[SET]' : '[NULL]' })

  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Error creating transaction:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    console.error('Error details:', error.details)
    console.error('Error hint:', error.hint)
    
    // Provide more helpful error messages
    if (error.message?.includes('row-level security') || error.code === '42501') {
      throw new Error('Permission denied. Please run the RLS fix script: supabase/fix_transactions_rls.sql in your Supabase SQL Editor. Make sure you are logged in and the policies are correctly set up.')
    }
    throw new Error(`Failed to create transaction: ${error.message || error.code || 'Unknown error'}`)
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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
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
    .eq('organization_id', organizationId)
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

export async function assignCustomerToTransaction(
  transactionId: string,
  customerId: string | null
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  // Get the current customer ID before updating (for revalidation)
  const { data: currentTransaction } = await supabase
    .from('transactions')
    .select('accounting_customer_id')
    .eq('id', transactionId)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  const { error } = await supabase
    .from('transactions')
    .update({ accounting_customer_id: customerId })
    .eq('id', transactionId)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/accounting/transactions')
  revalidatePath(`/accounting/transactions/${transactionId}`)
  
  // Revalidate the customer detail pages
  if (customerId) {
    // Revalidate the new customer's page
    revalidatePath(`/accounting/customers/${customerId}`)
  }
  if (currentTransaction?.accounting_customer_id) {
    // Revalidate the old customer's page (if it was assigned to someone)
    revalidatePath(`/accounting/customers/${currentTransaction.accounting_customer_id}`)
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  // If this is a transfer transaction, delete the linked transaction too
  const { data: transaction } = await supabase
    .from('transactions')
    .select('transfer_transaction_id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  if (transaction?.transfer_transaction_id) {
    await supabase
      .from('transactions')
      .delete()
      .eq('id', transaction.transfer_transaction_id)
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)

  if (error) {
    console.error('Error deleting transaction:', error)
    throw new Error('Failed to delete transaction')
  }

  revalidatePath('/accounting/transactions')
}















