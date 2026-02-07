import { getAccount } from '@/app/actions/accounts'
import { getTransactions } from '@/app/actions/transactions'
import { AccountDetail } from '@/components/accounting/account-detail'
import { AccountingNav } from '@/components/accounting/accounting-nav'
import { AppLayout } from '@/components/layout/app-layout'
import { notFound } from 'next/navigation'

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const account = await getAccount(id)
  if (!account) notFound()

  const [allTransactions, regularTransactions, transferTransactions] = await Promise.all([
    getTransactions({ account_id: id }),
    getTransactions({ account_id: id, exclude_transfers: true }),
    getTransactions({ account_id: id, transfers_only: true }),
  ])

  const incoming = allTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const outgoing = allTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AccountingNav />
          <AccountDetail
            account={account}
            regularTransactions={regularTransactions}
            transferTransactions={transferTransactions}
            incoming={incoming}
            outgoing={outgoing}
          />
        </div>
      </div>
    </AppLayout>
  )
}
