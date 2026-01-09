import { getTransaction } from '@/app/actions/transactions'
import { TransactionDetail } from '@/components/accounting/transaction-detail'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'

export default async function TransactionDetailPage({
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <TransactionDetail transaction={transaction} />
        </div>
      </div>
    </AppLayout>
  )
}
















