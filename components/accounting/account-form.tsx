'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { createAccount, updateAccount } from '@/app/actions/accounts'
import { useToast } from '@/components/ui/toaster'
import type { Account } from '@/types/database'
import { useRouter } from 'next/navigation'

interface AccountFormProps {
  account?: Account
  onSuccess?: (account: Account) => void
}

export function AccountForm({ account, onSuccess }: AccountFormProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: account?.name || '',
    account_number: account?.account_number || '',
    bank_name: account?.bank_name || '',
    bank_phone: account?.bank_phone || '',
    type: account?.type || 'bank',
    currency: account?.currency || 'BGN',
    opening_balance: account?.opening_balance || 0,
    notes: account?.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let result: Account
      if (account) {
        result = await updateAccount(account.id, formData)
      } else {
        result = await createAccount(formData)
      }

      toast({
        title: 'Success',
        description: account ? 'Account updated successfully' : 'Account created successfully',
      })

      if (onSuccess) {
        onSuccess(result)
      } else {
        router.push('/accounting/accounts')
        router.refresh()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save account',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Name *</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., Bank account - hostado"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Account Number</label>
          <Input
            value={formData.account_number}
            onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
            placeholder="e.g., 6"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Bank Name</label>
          <Input
            value={formData.bank_name}
            onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
            placeholder="e.g., Unicredit"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Bank Phone</label>
          <Input
            value={formData.bank_phone}
            onChange={(e) => setFormData({ ...formData, bank_phone: e.target.value })}
            placeholder="e.g., +359..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Type *</label>
          <Select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            required
          >
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="credit_card">Credit Card</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Currency *</label>
          <Select
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            required
          >
            <option value="BGN">BGN (Bulgarian Lev)</option>
            <option value="EUR">EUR (Euro)</option>
            <option value="USD">USD (US Dollar)</option>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Opening Balance</label>
        <Input
          type="number"
          step="0.01"
          value={formData.opening_balance}
          onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Notes</label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : account ? 'Update Account' : 'Create Account'}
        </Button>
      </div>
    </form>
  )
}















