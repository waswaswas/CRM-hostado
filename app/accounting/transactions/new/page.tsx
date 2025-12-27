import { getAccounts } from '@/app/actions/accounts'
import { getClients } from '@/app/actions/clients'
import { TransactionForm } from '@/components/accounting/transaction-form'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: { contact_id?: string; accounting_customer_id?: string; type?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const accounts = await getAccounts()
  const clients = await getClients()

  // Get default categories
  const { data: categories } = await supabase
    .from('transaction_categories')
    .select('*')
    .eq('owner_id', user.id)
    .order('name', { ascending: true })

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">New Transaction</h1>
              <p className="text-muted-foreground">Create a new income or expense transaction</p>
            </div>
          </div>
          <TransactionForm 
            accounts={accounts} 
            clients={clients} 
            categories={categories || []}
            initialContactId={searchParams.accounting_customer_id || searchParams.contact_id}
            initialType={searchParams.type as 'income' | 'expense' | undefined}
          />
        </div>
      </div>
    </AppLayout>
  )
}
