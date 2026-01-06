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
import { linkAccountingCustomerToClient } from '@/app/actions/accounting-customers'
import { getAccountingCustomers } from '@/app/actions/accounting-customers'
import { useToast } from '@/components/ui/toaster'
import type { AccountingCustomerWithRelations } from '@/types/database'
import { Link as LinkIcon, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LinkAccountingCustomerDialogProps {
  clientId: string
  currentAccountingCustomerId?: string | null
  currentAccountingCustomerName?: string
}

export function LinkAccountingCustomerDialog({ 
  clientId,
  currentAccountingCustomerId,
  currentAccountingCustomerName
}: LinkAccountingCustomerDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState(currentAccountingCustomerId || '')
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<AccountingCustomerWithRelations[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    async function loadCustomers() {
      setLoadingCustomers(true)
      try {
        const data = await getAccountingCustomers()
        setCustomers(data)
      } catch (error) {
        console.error('Failed to load customers:', error)
        toast({
          title: 'Error',
          description: 'Failed to load accounting customers',
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

  const handleLink = async () => {
    if (!selectedCustomerId) {
      toast({
        title: 'Error',
        description: 'Please select an accounting customer to link',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await linkAccountingCustomerToClient(selectedCustomerId, clientId)
      toast({
        title: 'Success',
        description: 'Linked to accounting customer successfully',
      })
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to link customer',
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
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
      >
        {currentAccountingCustomerName ? (
          <>
            <LinkIcon className="h-4 w-4" />
            <span>{currentAccountingCustomerName}</span>
          </>
        ) : (
          <>
            <LinkIcon className="h-4 w-4" />
            <span>Link Accounting</span>
          </>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Accounting Customer</DialogTitle>
            <DialogDescription>
              Link this CRM client to an accounting customer to sync their data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Accounting Customer</label>
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
              <Button onClick={handleLink} disabled={loading}>
                {loading ? 'Linking...' : 'Link'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
















