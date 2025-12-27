import { getTransaction } from '@/app/actions/transactions'
import { TransactionDetail } from '@/components/accounting/transaction-detail'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'

export default async function TransactionDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const transaction = await getTransaction(params.id)

  if (!transaction) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <TransactionDetail transaction={transaction} />
    </div>
  )
}
