'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { createTransaction, updateTransaction } from '@/app/actions/transactions'
import { useToast } from '@/components/ui/toaster'
import { useRouter } from 'next/navigation'
import type { Account, Client, TransactionCategory } from '@/types/database'
import { format } from 'date-fns'

interface TransactionFormProps {
  transaction?: any
  accounts: Account[]
  clients: Client[]
  categories: TransactionCategory[]
  initialContactId?: string
  initialType?: 'income' | 'expense'
}

export function TransactionForm({
  transaction,
  accounts,
  clients,
  categories,
  initialContactId,
  initialType,
}: TransactionFormProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [transactionType, setTransactionType] = useState<'income' | 'expense' | 'transfer'>(
    transaction?.type || initialType || 'expense'
  )

  const [formData, setFormData] = useState({
    account_id: transaction?.account_id || accounts[0]?.id || '',
    type: transaction?.type || initialType || 'expense',
    date: transaction?.date || format(new Date(), 'yyyy-MM-dd'),
    amount: transaction?.amount || 0,
    currency: transaction?.currency || 'BGN',
    category: transaction?.category || '',
    payment_method: transaction?.payment_method || 'cash',
    description: transaction?.description || '',
    reference: transaction?.reference || '',
    contact_id: transaction?.contact_id || '',
    accounting_customer_id: transaction?.accounting_customer_id || initialContactId || '',
    transfer_to_account_id: '',
  })

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (transaction) {
        await updateTransaction(transaction.id, formData)
        toast({
          title: 'Success',
          description: 'Transaction updated successfully',
        })
      } else {
        // For transfers, validate transfer_to_account_id
        if (transactionType === 'transfer' && !formData.transfer_to_account_id) {
          toast({
            title: 'Error',
            description: 'Please select a destination account for the transfer',
            variant: 'destructive',
          })
          setLoading(false)
          return
        }

        await createTransaction({
          ...formData,
          type: transactionType,
          accounting_customer_id: formData.accounting_customer_id || undefined,
          contact_id: formData.contact_id || undefined,
          transfer_to_account_id: transactionType === 'transfer' ? formData.transfer_to_account_id : undefined,
        })
        toast({
          title: 'Success',
          description: 'Transaction created successfully',
        })
      }

      router.push('/accounting/transactions')
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save transaction',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      {!transaction && (
        <Tabs value={transactionType} onValueChange={(v) => {
          setTransactionType(v as any)
          setFormData({ ...formData, type: v as any })
        }}>
          <TabsList>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {transaction && (
        <div className="mb-4">
          <Badge className={
            transaction.type === 'income'
              ? 'bg-green-100 text-green-800'
              : transaction.type === 'expense'
              ? 'bg-red-100 text-red-800'
              : 'bg-blue-100 text-blue-800'
          }>
            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
          </Badge>
        </div>
      )}
      <div className={transaction ? '' : 'mt-6'}>
        <TabsList>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="transfer">Transfer</TabsTrigger>
        </TabsList>

        {!transaction ? (
          <TabsContent value={transactionType} className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Here you can enter the general information of transaction such as date, amount, account, description, etc.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  Account <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  required
                >
                  <option value="">Select Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </div>
              {transactionType === 'transfer' && (
                <div>
                  <label className="text-sm font-medium">
                    Transfer To Account <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.transfer_to_account_id}
                    onChange={(e) => setFormData({ ...formData, transfer_to_account_id: e.target.value })}
                    required={transactionType === 'transfer'}
                  >
                    <option value="">Select Account</option>
                    {accounts
                      .filter((account) => account.id !== formData.account_id)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </Select>
                </div>
              )}
              {transactionType !== 'transfer' && (
                <div>
                  <label className="text-sm font-medium">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    required
                    placeholder="лв0,00"
                  />
                </div>
              )}
            </div>

            {transactionType === 'transfer' && (
              <div>
                <label className="text-sm font-medium">
                  Amount <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                  placeholder="лв0,00"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter Description"
                rows={4}
              />
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">
                Select a category and {transactionType === 'income' ? 'customer' : 'vendor'} to make your reports more detailed.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="">Select Category</option>
                    {(transactionType === 'income' ? incomeCategories : expenseCategories).map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {transactionType === 'income' ? 'Customer' : 'Vendor'}
                  </label>
                  <Select
                    value={formData.contact_id}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                  >
                    <option value="">- Select {transactionType === 'income' ? 'Customer' : 'Vendor'} -</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium">Tax</label>
                <Select>
                  <option value="">- Select Tax -</option>
                </Select>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">
                Enter a number and reference to keep the transaction linked to your records.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">
                    Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={transaction?.number || 'Auto-generated'}
                    disabled={!transaction}
                    placeholder="TRA-XXXXX"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Reference</label>
                  <Input
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Enter Reference"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : transaction ? 'Update Transaction' : 'Create Transaction'}
              </Button>
            </div>
          </form>
          </TabsContent>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Here you can enter the general information of transaction such as date, amount, account, description, etc.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  Account <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  required
                >
                  <option value="">Select Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Amount <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                  placeholder="лв0,00"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter Description"
                rows={4}
              />
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">
                Select a category and {transaction.type === 'income' ? 'customer' : 'vendor'} to make your reports more detailed.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="">Select Category</option>
                    {(transaction.type === 'income' ? incomeCategories : expenseCategories).map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {transaction.type === 'income' ? 'Customer' : 'Vendor'}
                  </label>
                  <Select
                    value={formData.contact_id}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                  >
                    <option value="">- Select {transaction.type === 'income' ? 'Customer' : 'Vendor'} -</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium">Tax</label>
                <Select>
                  <option value="">- Select Tax -</option>
                </Select>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">
                Enter a number and reference to keep the transaction linked to your records.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">
                    Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={transaction.number}
                    disabled
                    placeholder="TRA-XXXXX"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Reference</label>
                  <Input
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Enter Reference"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Update Transaction'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
