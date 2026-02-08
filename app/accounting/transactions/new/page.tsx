import { getAccounts } from '@/app/actions/accounts'
import { getAccountingCustomers } from '@/app/actions/accounting-customers'
import { getDistinctExpenseCategories } from '@/app/actions/accounting-stats'
import { TransactionForm } from '@/components/accounting/transaction-form'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ contact_id?: string; accounting_customer_id?: string; type?: string; account_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [accounts, accountingCustomers, categories] = await Promise.all([
    getAccounts(),
    getAccountingCustomers().catch(() => []),
    getDistinctExpenseCategories(),
  ])

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
            accountingCustomers={accountingCustomers}
            categories={categories}
            initialCustomerId={params.accounting_customer_id || params.contact_id}
            initialType={params.type as 'income' | 'expense' | 'transfer' | undefined}
            initialAccountId={params.account_id}
          />
        </div>
      </div>
    </AppLayout>
  )
}
















