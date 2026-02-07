import { getAccount } from '@/app/actions/accounts'
import { AccountForm } from '@/components/accounting/account-form'
import { AccountingNav } from '@/components/accounting/accounting-nav'
import { AppLayout } from '@/components/layout/app-layout'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const account = await getAccount(id)
  if (!account) notFound()

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AccountingNav />
          <div className="flex items-center gap-4">
            <Link href={`/accounting/accounts/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Edit Account</h1>
              <p className="text-muted-foreground">Update account details</p>
            </div>
          </div>
          <AccountForm account={account} />
        </div>
      </div>
    </AppLayout>
  )
}
