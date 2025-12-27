import { getAccounts } from '@/app/actions/accounts'
import { AccountsList } from '@/components/accounting/accounts-list'
import { AccountingNav } from '@/components/accounting/accounting-nav'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AccountsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Initialize default categories for the user if they don't exist
  const { data: categories } = await supabase
    .from('transaction_categories')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)

  if (!categories || categories.length === 0) {
    await supabase.rpc('initialize_default_categories', { user_id: user.id })
  }

  const accounts = await getAccounts()

  return (
    <div className="space-y-6">
      <AccountingNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage your bank accounts and cash</p>
        </div>
      </div>
      <AccountsList accounts={accounts} />
    </div>
  )
}
