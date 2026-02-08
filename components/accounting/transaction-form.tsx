'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { createTransaction, updateTransaction } from '@/app/actions/transactions'
import { useToast } from '@/components/ui/toaster'
import { useRouter } from 'next/navigation'
import type { Account, AccountingCustomerWithRelations } from '@/types/database'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { UserPlus } from 'lucide-react'
import Link from 'next/link'

interface TransactionFormProps {
  transaction?: any
  accounts: Account[]
  accountingCustomers: AccountingCustomerWithRelations[]
  categories?: string[]
  initialCustomerId?: string
  initialType?: 'income' | 'expense' | 'transfer'
  initialAccountId?: string
}

export function TransactionForm({
  transaction,
  accounts,
  accountingCustomers,
  categories = [],
  initialCustomerId,
  initialType,
  initialAccountId,
}: TransactionFormProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [transactionType, setTransactionType] = useState<'income' | 'expense' | 'transfer'>(
    transaction?.type || initialType || 'expense'
  )

  const [formData, setFormData] = useState({
    account_id: transaction?.account_id || initialAccountId || accounts[0]?.id || '',
    type: transaction?.type || initialType || 'expense',
    date: transaction?.date || format(new Date(), 'yyyy-MM-dd'),
    amount: transaction?.amount || 0,
    currency: transaction?.currency || 'EUR',
    category: transaction?.category || '',
    description: transaction?.description || '',
    accounting_customer_id: transaction?.accounting_customer_id || initialCustomerId || '',
    attachment_url: transaction?.attachment_url || '',
    transfer_to_account_id: transaction?.transfer_to_account_id || '',
  })

  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Error',
        description: 'Please upload a PDF file',
        variant: 'destructive',
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: 'Error',
        description: 'File size must be less than 10MB',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    setUploading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const filePath = `transaction-invoices/${fileName}`
      
      // Store the full path for later retrieval
      // Format: transaction-invoices/{userId}/{timestamp}.pdf

      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        // Try to create the bucket if it doesn't exist
        if (uploadError.message.includes('Bucket not found')) {
          toast({
            title: 'Error',
            description: 'Storage bucket not configured. Please create a private "transaction-attachments" bucket in Supabase Storage.',
            variant: 'destructive',
          })
        } else {
          throw uploadError
        }
        return
      }

      // Store the file path instead of a public URL (we'll generate signed URLs when needed)
      // The path format: transaction-invoices/{userId}/{timestamp}.pdf
      setFormData((prev) => ({ ...prev, attachment_url: filePath }))
      toast({
        title: 'Success',
        description: 'Invoice uploaded successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload invoice',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (transaction) {
        await updateTransaction(transaction.id, {
          account_id: formData.account_id,
          type: formData.type as 'income' | 'expense' | 'transfer',
          date: formData.date,
          amount: formData.amount,
          currency: formData.currency,
          category: formData.category?.trim() || undefined,
          description: formData.description || undefined,
          accounting_customer_id: formData.accounting_customer_id || undefined,
        })
        toast({
          title: 'Success',
          description: 'Transaction updated successfully',
        })
      } else {
        const transactionData: any = {
          account_id: formData.account_id,
          type: transactionType,
          date: formData.date,
          amount: formData.amount,
          currency: formData.currency,
          category: formData.category?.trim() || undefined,
          description: formData.description || undefined,
          accounting_customer_id: formData.accounting_customer_id || undefined,
        }

        if (transactionType === 'transfer') {
          if (!formData.transfer_to_account_id) {
            throw new Error('Please select the destination account for the transfer.')
          }
          if (formData.transfer_to_account_id === formData.account_id) {
            throw new Error('Transfer accounts must be different.')
          }
          transactionData.transfer_to_account_id = formData.transfer_to_account_id
        }
        
        // Only include attachment_url if it's not empty
        if (formData.attachment_url && formData.attachment_url.trim() !== '') {
          transactionData.attachment_url = formData.attachment_url
        }
        
        await createTransaction(transactionData)
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
      <form onSubmit={handleSubmit} className="space-y-6">
        {!transaction && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={transactionType === 'income' ? 'default' : 'outline'}
              onClick={() => {
                setTransactionType('income')
                setFormData({ ...formData, type: 'income' })
              }}
            >
              Income
            </Button>
            <Button
              type="button"
              variant={transactionType === 'expense' ? 'default' : 'outline'}
              onClick={() => {
                setTransactionType('expense')
                setFormData({ ...formData, type: 'expense' })
              }}
            >
              Expense
            </Button>
            <Button
              type="button"
              variant={transactionType === 'transfer' ? 'default' : 'outline'}
              onClick={() => {
                setTransactionType('transfer')
                setFormData({ ...formData, type: 'transfer' })
              }}
            >
              Transfer
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">
              {transactionType === 'transfer' ? 'From Account' : 'Account'} <span className="text-red-500">*</span>
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
          {transactionType === 'transfer' ? (
            <div>
              <label className="text-sm font-medium">
                To Account <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.transfer_to_account_id}
                onChange={(e) =>
                  setFormData({ ...formData, transfer_to_account_id: e.target.value })
                }
                required
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
          ) : (
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
                placeholder="0.00"
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
              placeholder="0.00"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">
              Currency <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              required
            >
              <option value="EUR">EUR</option>
              <option value="BGN">BGN</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
        </div>

        {transactionType !== 'transfer' && (
          <>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Ads, Dani payouts, Other"
                list="category-suggestions"
                className="mt-1"
              />
              {categories.length > 0 && (
                <datalist id="category-suggestions">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Customer</label>
            <div className="flex gap-2">
              <Select
                value={formData.accounting_customer_id}
                onChange={(e) => setFormData({ ...formData, accounting_customer_id: e.target.value })}
                className="flex-1"
              >
                <option value="">Select Customer</option>
                {accountingCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.company ? `(${customer.company})` : ''}
                  </option>
                ))}
              </Select>
              <Link href="/accounting/customers/new">
                <Button type="button" variant="outline" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Customer
                </Button>
              </Link>
            </div>
          </div>
          </>
        )}

        <div>
          <label className="text-sm font-medium">Notes</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter notes about this transaction"
            rows={4}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Invoice (PDF)</label>
          <Input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading && <p className="text-sm text-muted-foreground mt-1">Uploading...</p>}
          {formData.attachment_url && !uploading && (
            <p className="text-sm text-green-600 mt-1">✓ Invoice uploaded successfully</p>
          )}
          {selectedFile && !formData.attachment_url && !uploading && (
            <p className="text-sm text-muted-foreground mt-1">{selectedFile.name}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || uploading}>
            {loading ? 'Saving...' : transaction ? 'Update Transaction' : 'Create Transaction'}
          </Button>
        </div>
      </form>
    </div>
  )
}















