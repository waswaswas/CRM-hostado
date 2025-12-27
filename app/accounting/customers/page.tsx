import { getAccountingCustomers } from '@/app/actions/accounting-customers'
import { AccountingCustomersList } from '@/components/accounting/accounting-customers-list'
import { AccountingNav } from '@/components/accounting/accounting-nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AccountingCustomersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const customers = await getAccountingCustomers()

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AccountingNav />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Customers</h1>
              <p className="text-muted-foreground">Manage your customers and their financial information</p>
            </div>
          </div>
          <AccountingCustomersList initialCustomers={customers} />
        </div>
      </div>
    </AppLayout>
  )
}
