import { AccountingDashboard } from '@/components/accounting/accounting-dashboard'
import { AccountingNav } from '@/components/accounting/accounting-nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AccountingDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Default to current year
  const currentYear = new Date().getFullYear()
  const startDate = `${currentYear}-01-01`
  const endDate = `${currentYear}-12-31`

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AccountingNav />
          <div>
            <h1 className="text-3xl font-bold">Accounting Dashboard</h1>
            <p className="text-muted-foreground">Financial overview and analytics</p>
          </div>
          <AccountingDashboard startDate={startDate} endDate={endDate} />
        </div>
      </div>
    </AppLayout>
  )
}















