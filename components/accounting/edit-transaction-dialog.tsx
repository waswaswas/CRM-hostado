'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toaster'
import { updateTransaction } from '@/app/actions/transactions'
import type { Account, TransactionType, TransactionWithRelations } from '@/types/database'

interface EditTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: TransactionWithRelations | null
  accounts: Account[]
  onSaved?: (updated: { id: string; amount: number; currency: string; account_id: string; type: TransactionType }) => void
}

export function EditTransactionDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  onSaved,
}: EditTransactionDialogProps) {
  const { toast } = useToast()
  const [amount, setAmount] = useState<number>(0)
  const [currency, setCurrency] = useState<string>('BGN')
  const [accountId, setAccountId] = useState<string>('')
  const [type, setType] = useState<TransactionType>('expense')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!transaction) return
    setAmount(transaction.amount ?? 0)
    setCurrency(transaction.currency || 'BGN')
    setAccountId(transaction.account_id || '')
    setType(transaction.type || 'expense')
  }, [transaction])

  const handleSave = async () => {
    if (!transaction) return
    if (!amount || amount <= 0) {
      toast({
        title: 'Error',
        description: 'Amount must be greater than 0',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await updateTransaction(transaction.id, { amount, currency, account_id: accountId, type })
      onSaved?.({ id: transaction.id, amount, currency, account_id: accountId, type })
      toast({
        title: 'Success',
        description: 'Transaction updated',
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update transaction',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        {!transaction ? (
          <p className="text-sm text-muted-foreground">No transaction selected.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Account <span className="text-red-500">*</span>
              </label>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">
                Type <span className="text-red-500">*</span>
              </label>
              <Select value={type} onChange={(e) => setType(e.target.value as TransactionType)} required>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
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
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                required
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Currency <span className="text-red-500">*</span>
              </label>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)} required>
                <option value="EUR">EUR</option>
                <option value="BGN">BGN</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
