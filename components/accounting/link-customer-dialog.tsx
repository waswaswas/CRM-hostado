'use client'

import { useState } from 'react'
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
import { useToast } from '@/components/ui/toaster'
import { AccountingCustomerWithRelations, Client } from '@/types/database'
import { Link as LinkIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface LinkCustomerDialogProps {
  customer: AccountingCustomerWithRelations
  crmClients: Client[]
}

export function LinkCustomerDialog({ customer, crmClients }: LinkCustomerDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleLink = async () => {
    if (!selectedClientId) {
      toast({
        title: 'Error',
        description: 'Please select a CRM client to link',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await linkAccountingCustomerToClient(customer.id, selectedClientId)
      toast({
        title: 'Success',
        description: 'Customer linked to CRM client successfully',
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          Link CRM
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link to CRM Client</DialogTitle>
          <DialogDescription>
            Link this accounting customer to an existing CRM client to sync their data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select CRM Client</label>
            <Select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">-- Select a client --</option>
              {crmClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.company ? `(${client.company})` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLink} disabled={loading || !selectedClientId}>
              {loading ? 'Linking...' : 'Link'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}




