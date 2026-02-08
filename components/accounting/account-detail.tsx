'use client'

import { useState } from 'react'
import { Account } from '@/types/database'
import { TransactionWithRelations } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit, Plus, Star, Eye, MoreVertical } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface AccountDetailProps {
  account: Account
  regularTransactions: TransactionWithRelations[]
  transferTransactions: TransactionWithRelations[]
  incoming: number
  outgoing: number
}

export function AccountDetail({
  account,
  regularTransactions,
  transferTransactions,
  incoming,
  outgoing,
}: AccountDetailProps) {
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const formatAmount = (amount: number, currency: string = 'BGN') => {
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getTransferLabel = (transaction: TransactionWithRelations) => {
    if (transaction.transfer_to_account?.name) {
      return `Transfer to ${transaction.transfer_to_account.name}`
    }
    const sourceAccount = (transaction as any).transfer_transaction?.account || (transaction as any).transfer_from_account
    if (sourceAccount?.name) {
      return `Transfer from ${sourceAccount.name}`
    }
    return 'Transfer'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-semibold text-xl">
              {account.name.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{account.name}</h1>
              <Star className="h-5 w-5 text-muted-foreground" />
            </div>
            {account.bank_name && (
              <p className="text-muted-foreground mt-1">{account.bank_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="default" onClick={() => setShowNewMenu(!showNewMenu)}>
              <Plus className="mr-2 h-4 w-4" />
              New
              <span className="ml-1">▼</span>
            </Button>
            {showNewMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNewMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 min-w-[180px]">
                  <Link
                    href={`/accounting/transactions/new?account_id=${account.id}&type=income`}
                    className="block px-4 py-2 text-sm hover:bg-accent rounded-t-md"
                    onClick={() => setShowNewMenu(false)}
                  >
                    <Plus className="inline mr-2 h-4 w-4" />
                    Income
                  </Link>
                  <Link
                    href={`/accounting/transactions/new?account_id=${account.id}&type=expense`}
                    className="block px-4 py-2 text-sm hover:bg-accent"
                    onClick={() => setShowNewMenu(false)}
                  >
                    <Plus className="inline mr-2 h-4 w-4" />
                    Expense
                  </Link>
                  <Link
                    href={`/accounting/transactions/new?account_id=${account.id}&type=transfer`}
                    className="block px-4 py-2 text-sm hover:bg-accent rounded-b-md"
                    onClick={() => setShowNewMenu(false)}
                  >
                    <Plus className="inline mr-2 h-4 w-4" />
                    Transfer
                  </Link>
                </div>
              </>
            )}
          </div>
          <Link href={`/accounting/accounts/${account.id}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" size="icon" onClick={() => setShowMoreMenu(!showMoreMenu)}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Incoming</p>
            <p className="text-2xl font-semibold text-green-600">
              {formatAmount(incoming, account.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Outgoing</p>
            <p className="text-2xl font-semibold text-red-600">
              {formatAmount(outgoing, account.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p
              className={`text-2xl font-semibold ${
                account.current_balance < 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {formatAmount(account.current_balance, account.currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account details + Tabs */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 flex-shrink-0 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {account.account_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Account Number</p>
                  <p className="text-sm font-medium">{account.account_number}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Currency</p>
                <p className="text-sm font-medium">{account.currency}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Starting Balance</p>
                <p className="text-sm font-medium">
                  {formatAmount(account.opening_balance, account.currency)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="transactions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="transactions" className="gap-2">
                Transactions
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {regularTransactions.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="transfers" className="gap-2">
                Transfers
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {transferTransactions.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-2">
              {regularTransactions.length > 0 ? (
                <div className="space-y-2">
                  {regularTransactions.map((transaction) => (
                    <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                            <div>
                              <div className="text-sm font-medium">
                                {format(new Date(transaction.date), 'dd MMM yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">{transaction.number}</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    transaction.type === 'income'
                                      ? 'bg-green-500'
                                      : transaction.type === 'expense'
                                        ? 'bg-red-500'
                                        : 'bg-blue-500'
                                  }`}
                                />
                                <span className="text-sm font-medium capitalize">{transaction.type}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {transaction.category || 'N/A'}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground hidden md:block">
                              {transaction.contact?.name || 'N/A'}
                            </div>
                            <div className="text-sm text-muted-foreground hidden md:block">
                              {transaction.reference || 'N/A'}
                            </div>
                            <div
                              className={`text-right font-semibold ${
                                transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {transaction.type === 'expense' ? '-' : '+'}
                              {formatAmount(transaction.amount, transaction.currency)}
                            </div>
                          </div>
                          <Link href={`/accounting/transactions/${transaction.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No transactions yet.</p>
                    <Link href={`/accounting/transactions/new?account_id=${account.id}`}>
                      <Button className="mt-4" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Transaction
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="transfers" className="space-y-2">
              {transferTransactions.length > 0 ? (
                <div className="space-y-2">
                  {transferTransactions.map((transaction) => (
                    <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                            <div>
                              <div className="text-sm font-medium">
                                {format(new Date(transaction.date), 'dd MMM yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">{transaction.number}</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    transaction.type === 'income' ? 'bg-green-500' : 'bg-red-500'
                                  }`}
                                />
                                <span className="text-sm font-medium capitalize">{transaction.type}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <span className="text-blue-500">●</span>
                                {getTransferLabel(transaction)}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground hidden md:block">N/A</div>
                            <div className="text-sm text-muted-foreground hidden md:block">N/A</div>
                            <div
                              className={`text-right font-semibold ${
                                transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {transaction.type === 'expense' ? '-' : '+'}
                              {formatAmount(transaction.amount, transaction.currency)}
                            </div>
                          </div>
                          <Link href={`/accounting/transactions/${transaction.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No transfers yet.</p>
                    <Link href={`/accounting/transactions/new?account_id=${account.id}&type=transfer`}>
                      <Button className="mt-4" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        New Transfer
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
