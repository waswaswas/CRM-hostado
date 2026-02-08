import { getTransaction } from '@/app/actions/transactions'
import { getAccounts } from '@/app/actions/accounts'
import { getAccountingCustomers } from '@/app/actions/accounting-customers'
import { getDistinctExpenseCategories } from '@/app/actions/accounting-stats'
import { TransactionForm } from '@/components/accounting/transaction-form'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const transaction = await getTransaction(id)
  if (!transaction) {
    notFound()
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
              <h1 className="text-3xl font-bold">Edit Transaction</h1>
              <p className="text-muted-foreground">Update transaction details</p>
            </div>
          </div>
          <TransactionForm
            transaction={transaction}
            accounts={accounts}
            accountingCustomers={accountingCustomers}
            categories={categories}
          />
        </div>
      </div>
    </AppLayout>
  )
}
















