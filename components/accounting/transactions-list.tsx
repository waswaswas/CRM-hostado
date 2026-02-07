'use client'

import { useState, useMemo } from 'react'
import { TransactionWithRelations, Account } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, ArrowUpDown, Upload, Download, UserPlus, Trash2, Eye } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AssignCustomerDialog } from './assign-customer-dialog'
import { EditTransactionDialog } from './edit-transaction-dialog'
import { deleteTransaction } from '@/app/actions/transactions'
import { useToast } from '@/components/ui/toaster'

interface TransactionsListProps {
  initialTransactions: TransactionWithRelations[]
  accounts: Account[]
}

export function TransactionsList({ initialTransactions, accounts }: TransactionsListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [transactions, setTransactions] = useState(initialTransactions)
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRelations | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const xlsxModule = await import('xlsx')
      const XLSX = xlsxModule.default ?? xlsxModule
      const rows = filteredAndSorted.map((t) => ({
        type: t.type,
        number: t.number,
        paid_at: t.date,
        amount: t.amount,
        currency_code: t.currency || 'BGN',
        account_name: t.account?.name ?? '',
        category_name: t.category ?? '',
        contact_email: t.contact?.email ?? t.contact?.name ?? '',
        description: t.description ?? '',
        reference: t.reference ?? '',
        payment_method: t.payment_method ?? '',
        transfer_to_account: t.transfer_to_account?.name ?? '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
      const filename = `transactions-export-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
      toast({
        title: 'Export complete',
        description: `Exported ${rows.length} transaction(s) to ${filename}`,
      })
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

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

  const handleToggleSelect = (transactionId: string) => {
    setSelectedTransactions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId)
      } else {
        newSet.add(transactionId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedTransactions.size === filteredAndSorted.length) {
      setSelectedTransactions(new Set())
    } else {
      setSelectedTransactions(new Set(filteredAndSorted.map((t) => t.id)))
    }
  }

  const handleDelete = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return
    }

    try {
      await deleteTransaction(transactionId)
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId))
      setSelectedTransactions((prev) => {
        const newSet = new Set(prev)
        newSet.delete(transactionId)
        return newSet
      })
      toast({
        title: 'Success',
        description: 'Transaction deleted successfully',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete transaction',
        variant: 'destructive',
      })
    }
  }

  const handleEditClick = (transaction: TransactionWithRelations) => {
    setEditingTransaction(transaction)
    setEditDialogOpen(true)
  }

  const handleEditSaved = (updated: { id: string; amount: number; currency: string; account_id: string; type: string }) => {
    setTransactions((prev) =>
      prev.map((transaction) =>
        transaction.id === updated.id
          ? {
              ...transaction,
              amount: updated.amount,
              currency: updated.currency,
              account_id: updated.account_id,
              type: updated.type as any,
              account: accounts.find((account) => account.id === updated.account_id) || transaction.account,
            }
          : transaction
      )
    )
  }

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return

    const count = selectedTransactions.size
    if (!confirm(`Are you sure you want to delete ${count} transaction${count > 1 ? 's' : ''}?`)) {
      return
    }

    setDeleting(true)
    let successCount = 0
    let failCount = 0

    for (const transactionId of Array.from(selectedTransactions)) {
      try {
        await deleteTransaction(transactionId)
        setTransactions((prev) => prev.filter((t) => t.id !== transactionId))
        successCount++
      } catch (error) {
        console.error(`Failed to delete transaction ${transactionId}:`, error)
        failCount++
      }
    }

    setSelectedTransactions(new Set())
    setDeleting(false)

    if (failCount === 0) {
      toast({
        title: 'Success',
        description: `Successfully deleted ${successCount} transaction${successCount > 1 ? 's' : ''}`,
      })
    } else {
      toast({
        title: 'Partial Success',
        description: `Deleted ${successCount} transaction${successCount > 1 ? 's' : ''}, ${failCount} failed`,
        variant: 'destructive',
      })
    }

    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 min-w-0">
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
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full sm:w-auto min-w-[120px]"
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </Select>
          <Select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="w-full sm:w-auto min-w-[140px]"
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
            className="w-full sm:w-auto whitespace-nowrap"
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
          </Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link href="/accounting/import">
              <Button variant="outline" size="sm" className="w-full sm:w-auto whitespace-nowrap">
                <Upload className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto whitespace-nowrap"
              onClick={handleExport}
              disabled={exporting || filteredAndSorted.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
            </Button>
            <Link href="/accounting/transactions/new">
              <Button size="sm" className="w-full sm:w-auto whitespace-nowrap">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New</span>
                <span className="sm:hidden">+</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedTransactions.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedTransactions.size} transaction{selectedTransactions.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTransactions(new Set())}
            >
              Clear Selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? 'Deleting...' : `Delete ${selectedTransactions.size}`}
            </Button>
          </div>
        </div>
      )}

      {/* Select All Checkbox */}
      {filteredAndSorted.length > 0 && (
        <div className="flex items-center gap-2 pb-2 border-b">
          <input
            type="checkbox"
            checked={selectedTransactions.size > 0 && selectedTransactions.size === filteredAndSorted.length}
            onChange={handleSelectAll}
            className="h-5 w-5 rounded-full border-2 border-gray-300 cursor-pointer appearance-none checked:bg-primary checked:border-primary checked:after:content-['✓'] checked:after:text-white checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-xs transition-colors"
          />
          <label className="text-sm font-medium cursor-pointer" onClick={handleSelectAll}>
            Select All ({filteredAndSorted.length})
          </label>
        </div>
      )}

      <div className="space-y-2">
        {filteredAndSorted.length > 0 ? (
          <div className="space-y-2">
            {filteredAndSorted.map((transaction) => (
              <Card
                key={transaction.id}
                className="hover:shadow-md transition-shadow rounded-lg cursor-pointer"
                onClick={() => handleEditClick(transaction)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleEditClick(transaction)
                  }
                }}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      {/* Checkbox for bulk selection */}
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(transaction.id)}
                        onChange={() => handleToggleSelect(transaction.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5 rounded-full border-2 border-gray-300 cursor-pointer flex-shrink-0 mt-0.5 appearance-none checked:bg-primary checked:border-primary checked:after:content-['✓'] checked:after:text-white checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-xs transition-colors"
                      />
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-start sm:items-center min-w-0">
                        <div className="col-span-12 sm:col-span-2">
                          <div className="text-sm font-medium">
                            {format(new Date(transaction.date), 'dd MMM yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{transaction.number}</div>
                        </div>
                        <div className="col-span-12 sm:col-span-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              transaction.type === 'income' ? 'bg-green-500' : 
                              transaction.type === 'expense' ? 'bg-red-500' : 
                              'bg-blue-500'
                            }`} />
                            <span className="text-sm font-medium capitalize truncate">{transaction.type}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {transaction.category || 'N/A'}
                          </div>
                        </div>
                        <div className="col-span-6 sm:col-span-2 text-sm truncate" title={transaction.account?.name || 'N/A'}>
                          <span className="text-xs text-muted-foreground sm:hidden">Account: </span>
                          {transaction.account?.name || 'N/A'}
                        </div>
                        <div className="col-span-6 sm:col-span-2 text-sm text-muted-foreground truncate" title={transaction.contact?.name || 'N/A'}>
                          <span className="text-xs sm:hidden">Contact: </span>
                          {transaction.contact?.name || 'N/A'}
                        </div>
                        <div className="hidden sm:block col-span-1 text-sm text-muted-foreground truncate" title={transaction.reference || 'N/A'}>
                          {transaction.reference || 'N/A'}
                        </div>
                        <div className="col-span-12 sm:col-span-1 flex items-center justify-start sm:justify-center flex-shrink-0">
                          <div onClick={(event) => event.stopPropagation()}>
                            <AssignCustomerDialog
                              transactionId={transaction.id}
                              currentCustomerId={(transaction as any).accounting_customer_id}
                              currentCustomerName={(transaction as any).accounting_customer?.name}
                            />
                          </div>
                        </div>
                        <div className="col-span-12 sm:col-span-2 flex items-center justify-between sm:justify-end">
                          <div
                            className={`font-semibold text-base sm:text-sm ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.type === 'expense' ? '-' : '+'}
                            {formatAmount(transaction.amount, transaction.currency)}
                          </div>
                          <div className="flex items-center gap-1 sm:hidden" onClick={(event) => event.stopPropagation()}>
                            <Link href={`/accounting/transactions/${transaction.id}`}>
                              <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px] min-w-[44px] p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(transaction.id)}
                              title="Delete transaction"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 flex-shrink-0" onClick={(event) => event.stopPropagation()}>
                      <Link href={`/accounting/transactions/${transaction.id}`}>
                        <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] md:h-8 md:w-8 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[44px] md:h-8 md:w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(transaction.id)}
                        title="Delete transaction"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
      <EditTransactionDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditingTransaction(null)
          }
        }}
        transaction={editingTransaction}
        accounts={accounts}
        onSaved={handleEditSaved}
      />
    </div>
  )
}
















