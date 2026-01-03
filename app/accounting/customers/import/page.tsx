import { AccountingNav } from '@/components/accounting/accounting-nav'
import { ImportCustomers } from '@/components/accounting/import-customers'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ImportCustomersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AccountingNav />
          <div>
            <h1 className="text-3xl font-bold">Import Customers</h1>
            <p className="text-muted-foreground">Import customers from Excel file</p>
          </div>
          <ImportCustomers />
        </div>
      </div>
    </AppLayout>
  )
}















