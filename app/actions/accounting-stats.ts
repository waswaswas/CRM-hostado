'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationId } from './organizations'

export interface CashFlowData {
  date: string
  incoming: number
  outgoing: number
  profit: number
}

export interface ProfitLossData {
  date: string
  income: number
  expense: number
}

export interface ExpenseByCategory {
  category: string
  amount: number
}

export interface TopPayer {
  name: string
  amount: number
}

export async function getCashFlow(
  startDate: string,
  endDate: string
): Promise<CashFlowData[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('date, type, amount')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate)
    .in('type', ['income', 'expense'])
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching cash flow:', error)
    throw new Error('Failed to fetch cash flow data')
  }

  // Group by date
  const grouped = new Map<string, { incoming: number; outgoing: number }>()

  data?.forEach((transaction: { date: string; type: string; amount: number }) => {
    const date = transaction.date
    if (!grouped.has(date)) {
      grouped.set(date, { incoming: 0, outgoing: 0 })
    }
    const day = grouped.get(date)!
    if (transaction.type === 'income') {
      day.incoming += Number(transaction.amount)
    } else {
      day.outgoing += Number(transaction.amount)
    }
  })

  // Convert to array and calculate profit
  const result: CashFlowData[] = Array.from(grouped.entries()).map(([date, values]) => ({
    date,
    incoming: values.incoming,
    outgoing: values.outgoing,
    profit: values.incoming - values.outgoing,
  }))

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getProfitLoss(
  startDate: string,
  endDate: string
): Promise<ProfitLossData[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('date, type, amount')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate)
    .in('type', ['income', 'expense'])
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching profit & loss:', error)
    throw new Error('Failed to fetch profit & loss data')
  }

  // Group by month
  const grouped = new Map<string, { income: number; expense: number }>()

  data?.forEach((transaction: { date: string; type: string; amount: number }) => {
    const date = new Date(transaction.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, { income: 0, expense: 0 })
    }
    const month = grouped.get(monthKey)!
    if (transaction.type === 'income') {
      month.income += Number(transaction.amount)
    } else {
      month.expense += Number(transaction.amount)
    }
  })

  // Convert to array
  const result: ProfitLossData[] = Array.from(grouped.entries()).map(([date, values]) => ({
    date,
    income: values.income,
    expense: values.expense,
  }))

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getExpensesByCategory(
  startDate: string,
  endDate: string
): Promise<ExpenseByCategory[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('category, amount')
    .eq('organization_id', organizationId)
    .eq('type', 'expense')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) {
    console.error('Error fetching expenses by category:', error)
    throw new Error('Failed to fetch expenses by category')
  }

  // Group by category (null/empty = "Other")
  const grouped = new Map<string, number>()

  data?.forEach((transaction: { category: string | null; amount: number }) => {
    const cat = (transaction.category || '').trim()
    const category = cat || 'Other'
    grouped.set(category, (grouped.get(category) || 0) + Number(transaction.amount))
  })

  // Convert to array and sort by amount descending
  const result: ExpenseByCategory[] = Array.from(grouped.entries())
    .map(([category, amount]) => ({
      category,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)

  return result
}

export async function getDistinctExpenseCategories(): Promise<string[]> {
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
    .from('transactions')
    .select('category')
    .eq('organization_id', organizationId)
    .in('type', ['income', 'expense'])
    .not('category', 'is', null)
    .neq('category', '')

  if (error) {
    console.error('Error fetching categories:', error)
    return []
  }

  const allCats = (data || []).map((t: { category: string }) => t.category.trim()).filter((c: string) => c.length > 0)
  const categories: string[] = Array.from(new Set(allCats))
  return categories.sort()
}

export interface ExpenseTransaction {
  id: string
  date: string
  amount: number
  currency: string
  description: string | null
  account_name?: string
}

export async function getExpenseTransactionsByCategory(
  category: string,
  startDate: string,
  endDate: string
): Promise<ExpenseTransaction[]> {
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

  let query = supabase
    .from('transactions')
    .select('id, date, amount, currency, description, account_id')
    .eq('organization_id', organizationId)
    .eq('type', 'expense')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (category === 'Other') {
    query = query.or('category.is.null,category.eq.')
  } else {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching transactions by category:', error)
    return []
  }

  const accountIds = [...new Set((data || []).map((t: any) => t.account_id).filter(Boolean))]
  const accountNames: Record<string, string> = {}
  if (accountIds.length > 0) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name')
      .in('id', accountIds)
    accounts?.forEach((a: { id: string; name: string }) => {
      accountNames[a.id] = a.name
    })
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    currency: t.currency || 'BGN',
    description: t.description,
    account_name: accountNames[t.account_id],
  }))
}

export async function getTopPayers(
  limit: number = 5,
  startDate?: string,
  endDate?: string
): Promise<TopPayer[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return []
  }

  let query = supabase
    .from('transactions')
    .select('contact_id, amount, contact:clients(name)')
    .eq('organization_id', organizationId)
    .eq('type', 'income')
    .not('contact_id', 'is', null)

  if (startDate) {
    query = query.gte('date', startDate)
  }
  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching top payers:', error)
    throw new Error('Failed to fetch top payers')
  }

  // Group by contact
  const grouped = new Map<string, { name: string; amount: number }>()

  data?.forEach((transaction: any) => {
    const contactId = transaction.contact_id
    const contactName = transaction.contact?.name || 'Unknown'
    if (!grouped.has(contactId)) {
      grouped.set(contactId, { name: contactName, amount: 0 })
    }
    grouped.get(contactId)!.amount += Number(transaction.amount)
  })

  // Convert to array, sort by amount, and limit
  const result: TopPayer[] = Array.from(grouped.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((item) => ({
      name: item.name,
      amount: item.amount,
    }))

  return result
}

export async function getAccountBalances(): Promise<
  Array<{ id: string; name: string; balance: number }>
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, current_balance')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching account balances:', error)
    throw new Error('Failed to fetch account balances')
  }

  return (
    data?.map((account: { id: string; name: string; current_balance: number }) => ({
      id: account.id,
      name: account.name,
      balance: Number(account.current_balance),
    })) || []
  )
}

export async function getAccountingSummary(
  startDate: string,
  endDate: string
): Promise<{
  totalIncome: number
  totalExpense: number
  profit: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return {
      totalIncome: 0,
      totalExpense: 0,
      profit: 0,
    }
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate)
    .in('type', ['income', 'expense'])

  if (error) {
    console.error('Error fetching accounting summary:', error)
    throw new Error('Failed to fetch accounting summary')
  }

  let totalIncome = 0
  let totalExpense = 0

  data?.forEach((transaction: { type: string; amount: number }) => {
    if (transaction.type === 'income') {
      totalIncome += Number(transaction.amount)
    } else {
      totalExpense += Number(transaction.amount)
    }
  })

  return {
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
  }
}
















