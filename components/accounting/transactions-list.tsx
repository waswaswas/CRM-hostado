'use client'

import { useState, useMemo } from 'react'
import { TransactionWithRelations, Account } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, ArrowUpDown } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface TransactionsListProps {
  initialTransactions: TransactionWithRelations[]
  accounts: Account[]
}

export function TransactionsList({ initialTransactions, accounts }: TransactionsListProps) {
  const router = useRouter()
  const [transactions] = useState(initialTransactions)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  const filteredAndSorted = useMemo(() => {
    let filtered = transactions.filter((transaction) => {
      const matchesSearch =
        transaction.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType = filterType === 'all' || transaction.type === filterType
      const matchesAccount = filterAccount === 'all' || transaction.account_id === filterAccount

      return matchesSearch && matchesType && matchesAccount
    })

    // Sort by date
    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

    return filtered
  }, [transactions, searchQuery, filterType, filterAccount, sortOrder])

  const formatAmount = (amount: number, currency: string = 'BGN') => {
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'expense':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'transfer':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search or filter results..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </Select>
        <Select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
        >
          <option value="all">All Accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
        >
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
        </Button>
        <Link href="/accounting/transactions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        {filteredAndSorted.length > 0 ? (
          <div className="space-y-2">
            {filteredAndSorted.map((transaction) => (
              <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid grid-cols-8 gap-4 items-center">
                      <div className="col-span-2">
                        <div className="text-sm font-medium">
                          {format(new Date(transaction.date), 'dd MMM yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">{transaction.number}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            transaction.type === 'income' ? 'bg-green-500' : 
                            transaction.type === 'expense' ? 'bg-red-500' : 
                            'bg-blue-500'
                          }`} />
                          <span className="text-sm font-medium capitalize">{transaction.type}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {transaction.category || 'N/A'}
                        </div>
                      </div>
                      <div className="col-span-1 text-sm">
                        {transaction.account?.name || 'N/A'}
                      </div>
                      <div className="col-span-1 text-sm text-muted-foreground">
                        {transaction.contact?.name || 'N/A'}
                      </div>
                      <div className="col-span-1 text-sm text-muted-foreground">
                        {transaction.reference || 'N/A'}
                      </div>
                      <div className="col-span-1 text-right">
                        <div
                          className={`font-semibold ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {transaction.type === 'expense' ? '-' : '+'}
                          {formatAmount(transaction.amount, transaction.currency)}
                        </div>
                      </div>
                    </div>
                    <Link href={`/accounting/transactions/${transaction.id}`}>
                      <Button variant="ghost" size="sm">
                        View
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
              <p className="text-muted-foreground">
                {searchQuery || filterType !== 'all' || filterAccount !== 'all'
                  ? 'No transactions found matching your filters.'
                  : 'No transactions yet.'}
              </p>
              {!searchQuery && filterType === 'all' && filterAccount === 'all' && (
                <Link href="/accounting/transactions/new">
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Transaction
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
