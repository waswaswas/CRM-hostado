import { getTransactions } from '@/app/actions/transactions'
import { getAccounts } from '@/app/actions/accounts'
import { TransactionsList } from '@/components/accounting/transactions-list'
import { AccountingNav } from '@/components/accounting/accounting-nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { TransactionWithRelations } from '@/types/database'
import type { Account } from '@/types/database'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  let transactions: TransactionWithRelations[] = []
  let accounts: Account[] = []
  let error: string | null = null

  try {
    transactions = await getTransactions()
    accounts = await getAccounts()
  } catch (err) {
    console.error('Error loading transactions page:', err)
    error = err instanceof Error ? err.message : 'Failed to load transactions'
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <AccountingNav />
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Transactions</h1>
                <p className="text-muted-foreground">View and manage your income and expenses</p>
              </div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="font-semibold text-red-800 mb-2">Error Loading Transactions</h3>
              <p className="text-red-700 text-sm">{error}</p>
              <p className="text-red-600 text-xs mt-2">
                Please check:
                <ul className="list-disc list-inside mt-1">
                  <li>That you ran the migration: <code className="bg-red-100 px-1 rounded">supabase/migration_accounting.sql</code></li>
                  <li>That the tables were created successfully</li>
                  <li>Check the browser console for more details</li>
                </ul>
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AccountingNav />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Transactions</h1>
              <p className="text-muted-foreground">View and manage your income and expenses</p>
            </div>
          </div>
          <TransactionsList initialTransactions={transactions} accounts={accounts} />
        </div>
      </div>
    </AppLayout>
  )
}















