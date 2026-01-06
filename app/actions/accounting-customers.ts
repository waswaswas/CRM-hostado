'use server'

import { createClient } from '@/lib/supabase/server'
import { AccountingCustomer, AccountingCustomerWithRelations } from '@/types/database'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId } from './organizations'

export async function getAccountingCustomers(): Promise<AccountingCustomerWithRelations[]> {
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
      .from('accounting_customers')
      .select(`
        *,
        linked_client:clients(*)
      `)
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        throw new Error('Accounting customers table does not exist. Please run the migration: supabase/migration_accounting_customers.sql')
      }
      throw new Error(error.message)
    }

    return (data || []) as AccountingCustomerWithRelations[]
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch accounting customers')
  }
}

export async function getAccountingCustomer(id: string): Promise<AccountingCustomerWithRelations | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return null
  }

  const { data, error } = await supabase
    .from('accounting_customers')
    .select(`
      *,
      linked_client:clients(*)
    `)
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(error.message)
  }

  return data as AccountingCustomerWithRelations
}

export async function createAccountingCustomer(data: {
  name: string
  company?: string
  email?: string
  phone?: string
  address?: string
  tax_number?: string
  website?: string
  notes?: string
  linked_client_id?: string
}): Promise<AccountingCustomer> {
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

  const { data: customer, error } = await supabase
    .from('accounting_customers')
    .insert({
      ...data,
      owner_id: user.id,
      organization_id: organizationId,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/accounting/customers')
  return customer as AccountingCustomer
}

export async function updateAccountingCustomer(
  id: string,
  data: Partial<Omit<AccountingCustomer, 'id' | 'created_at' | 'owner_id'>>
): Promise<AccountingCustomer> {
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

  const { data: customer, error } = await supabase
    .from('accounting_customers')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/accounting/customers')
  revalidatePath(`/accounting/customers/${id}`)
  return customer as AccountingCustomer
}

export async function deleteAccountingCustomer(id: string): Promise<void> {
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
    .from('accounting_customers')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/accounting/customers')
}

export async function linkAccountingCustomerToClient(
  accountingCustomerId: string,
  clientId: string | null
): Promise<void> {
  await updateAccountingCustomer(accountingCustomerId, {
    linked_client_id: clientId || null,
  })
}

export async function getAccountingCustomersByClientId(clientId: string): Promise<AccountingCustomerWithRelations[]> {
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
      .from('accounting_customers')
      .select(`
        *,
        linked_client:clients(*)
      `)
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)
      .eq('linked_client_id', clientId)
      .order('created_at', { ascending: false })

    if (error) {
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        return []
      }
      throw new Error(error.message)
    }

    return (data || []) as AccountingCustomerWithRelations[]
  } catch (error) {
    return []
  }
}

export async function getLinkedClientIds(): Promise<string[]> {
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
      .from('accounting_customers')
      .select('linked_client_id')
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)
      .not('linked_client_id', 'is', null)

    if (error) {
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        return []
      }
      return []
    }

    return (data || [])
      .map(customer => customer.linked_client_id)
      .filter((id): id is string => id !== null)
  } catch (error) {
    return []
  }
}
















