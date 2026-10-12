'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toaster'
import type { ProformaFormPayload } from '@/lib/inv-bg/types'
import {
  createInvBgProformaFromOffer,
  createInvBgProformaFromClient,
} from '@/app/actions/inv-bg'
import type { Offer } from '@/types/database'
import { Plus, Trash2, ExternalLink } from 'lucide-react'

type Mode =
  | { kind: 'offer'; offerId: string }
  | { kind: 'client'; clientId: string; attachOfferId?: string | null }

export function CreateProformaDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  initial: ProformaFormPayload
  onCreated?: (result: {
    number: string
    id: number
    url: string | null
    offer?: Offer
  }) => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<ProformaFormPayload>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  function updateItem(
    index: number,
    patch: Partial<ProformaFormPayload['items'][number]>
  ) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.to_name.trim()) {
      toast({
        title: 'Missing buyer',
        description: 'Company / name is required',
        variant: 'destructive',
      })
      return
    }
    if (!form.items.some((i) => i.name.trim() && i.unit_price >= 0)) {
      toast({
        title: 'Missing items',
        description: 'Add at least one line item with a name',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      if (mode.kind === 'offer') {
        const res = await createInvBgProformaFromOffer(mode.offerId, form)
        toast({
          title: 'Proforma created',
          description: `inv.bg № ${res.proforma.number}`,
        })
        onCreated?.({
          number: res.proforma.number,
          id: res.proforma.id,
          url: res.proforma.url,
          offer: res.offer,
        })
      } else {
        const res = await createInvBgProformaFromClient(mode.clientId, {
          ...form,
          attach_offer_id: mode.attachOfferId,
        })
        toast({
          title: 'Proforma created',
          description: res.sync
            ? `inv.bg № ${res.proforma.number} (saved on offer)`
            : `inv.bg № ${res.proforma.number}`,
        })
        onCreated?.({
          number: res.proforma.number,
          id: res.proforma.id,
          url: res.proforma.url,
        })
      }
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'inv.bg error',
        description: error instanceof Error ? error.message : 'Failed to create proforma',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create proforma (inv.bg)</DialogTitle>
          <DialogClose onClose={() => onOpenChange(false)} />
        </DialogHeader>
        <DialogDescription>
          Confirm buyer and line items. Document is created in inv.bg as a proforma (проформа).
        </DialogDescription>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Company / Name *</label>
              <Input
                value={form.to_name}
                onChange={(e) => setForm({ ...form, to_name: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">EIK / Булстат</label>
              <Input
                value={form.to_bulstat || ''}
                onChange={(e) => setForm({ ...form, to_bulstat: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">МОЛ</label>
              <Input
                value={form.to_mol || ''}
                onChange={(e) => setForm({ ...form, to_mol: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">City</label>
              <Input
                value={form.to_town || ''}
                onChange={(e) => setForm({ ...form, to_town: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={form.to_email || ''}
                onChange={(e) => setForm({ ...form, to_email: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Address</label>
              <Input
                value={form.to_address || ''}
                onChange={(e) => setForm({ ...form, to_address: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Currency</label>
              <Select
                value={form.payment_currency}
                onChange={(e) => setForm({ ...form, payment_currency: e.target.value })}
                disabled={loading}
              >
                <option value="EUR">EUR</option>
                <option value="BGN">BGN</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">VAT %</label>
              <Select
                value={String(form.vat_percent ?? 0)}
                onChange={(e) => setForm({ ...form, vat_percent: Number(e.target.value) })}
                disabled={loading}
              >
                <option value="0">0% (чл.113 ал.9)</option>
                <option value="20">20%</option>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                disabled={loading}
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Line items</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    items: [
                      ...prev.items,
                      { name: '', quantity: 1, unit_price: 0, quantity_unit: 'бр.' },
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_70px_90px_36px] gap-2 items-center">
                  <Input
                    placeholder="Name"
                    value={item.name}
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                    disabled={loading}
                  />
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                    disabled={loading}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateItem(index, { unit_price: parseFloat(e.target.value) || 0 })
                    }
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={loading || form.items.length <= 1}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        items: prev.items.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create in inv.bg'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function InvBgProformaBadge({
  number,
  url,
}: {
  number: string
  url?: string | null
}) {
  const href = url || undefined
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
      >
        Proforma №{number}
        <ExternalLink className="h-3 w-3" />
      </a>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium">
      Proforma №{number}
    </span>
  )
}
