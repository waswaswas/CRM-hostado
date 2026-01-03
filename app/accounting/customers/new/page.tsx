import { AccountingNav } from '@/components/accounting/accounting-nav'
import { AccountingCustomerForm } from '@/components/accounting/accounting-customer-form'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewAccountingCustomerPage() {
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
            <h1 className="text-3xl font-bold">New Customer</h1>
            <p className="text-muted-foreground">Create a new accounting customer</p>
          </div>
          <AccountingCustomerForm />
        </div>
      </div>
    </AppLayout>
  )
}















