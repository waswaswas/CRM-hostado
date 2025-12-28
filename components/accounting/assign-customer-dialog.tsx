'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { assignCustomerToTransaction } from '@/app/actions/transactions'
import { getAccountingCustomers } from '@/app/actions/accounting-customers'
import { useToast } from '@/components/ui/toaster'
import type { AccountingCustomerWithRelations } from '@/types/database'
import { UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AssignCustomerDialogProps {
  transactionId: string
  currentCustomerId?: string | null
  currentCustomerName?: string
}

export function AssignCustomerDialog({ 
  transactionId, 
  currentCustomerId,
  currentCustomerName 
}: AssignCustomerDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState(currentCustomerId || '')
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<AccountingCustomerWithRelations[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    async function loadCustomers() {
      setLoadingCustomers(true)
      try {
        // Call server action
        const data = await getAccountingCustomers()
        setCustomers(data)
      } catch (error) {
        console.error('Failed to load customers:', error)
        toast({
          title: 'Error',
          description: 'Failed to load customers',
          variant: 'destructive',
        })
      } finally {
        setLoadingCustomers(false)
      }
    }
    if (open) {
      loadCustomers()
    }
  }, [open, toast])

  const handleAssign = async () => {
    setLoading(true)
    try {
      await assignCustomerToTransaction(transactionId, selectedCustomerId || null)
      toast({
        title: 'Success',
        description: selectedCustomerId 
          ? 'Customer assigned successfully' 
          : 'Customer removed successfully',
      })
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign customer',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        className="h-8 px-3 whitespace-nowrap flex items-center gap-1.5"
        type="button"
        onClick={() => setOpen(true)}
      >
        {currentCustomerName ? (
          <span className="text-xs font-medium truncate max-w-[100px]">{currentCustomerName}</span>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs font-medium">Assign</span>
          </>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Customer</DialogTitle>
          <DialogDescription>
            Select a customer to assign to this transaction, or leave empty to remove assignment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Customer</label>
            {loadingCustomers ? (
              <p className="text-sm text-muted-foreground">Loading customers...</p>
            ) : (
              <div className="space-y-2">
                <Select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">-- No customer --</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.company ? `(${customer.company})` : ''}
                    </option>
                  ))}
                </Select>
                <Link href="/accounting/customers/new" className="block">
                  <Button variant="outline" className="w-full" type="button">
                    <UserPlus className="mr-2 h-4 w-4" />
                    +Add customer
                  </Button>
                </Link>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={loading}>
              {loading ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  )
}



