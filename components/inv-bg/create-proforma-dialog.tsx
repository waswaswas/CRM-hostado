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
  lookupInvBgBuyers,
  addRegisterFirmToInvBg,
  selectInvBgClientBuyer,
} from '@/app/actions/inv-bg'
import type { InvBgClient, InvBgRegisterFirm } from '@/lib/inv-bg/client'
import type { Offer } from '@/types/database'
import { Plus, Trash2, ExternalLink, Search, UserPlus, Loader2 } from 'lucide-react'

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
  const [lookupOpen, setLookupOpen] = useState(false)
  const [lookupQuery, setLookupQuery] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [addingFirmId, setAddingFirmId] = useState<number | null>(null)
  const [myClients, setMyClients] = useState<InvBgClient[]>([])
  const [registerFirms, setRegisterFirms] = useState<InvBgRegisterFirm[]>([])

  useEffect(() => {
    if (open) {
      setForm(initial)
      setLookupOpen(false)
      setLookupQuery(initial.to_name || '')
      setMyClients([])
      setRegisterFirms([])
    }
  }, [open, initial])

  function applyBuyer(buyer: {
    to_name: string
    to_town?: string
    to_address?: string
    to_bulstat?: string
    to_mol?: string
    to_vat_number?: string
    to_country?: string
    is_to_person?: boolean
  }) {
    setForm((prev) => ({
      ...prev,
      to_name: buyer.to_name,
      to_town: buyer.to_town || '',
      to_address: buyer.to_address || '',
      to_bulstat: buyer.to_bulstat || '',
      to_mol: buyer.to_mol || '',
      to_vat_number: buyer.to_vat_number || '',
      to_country: buyer.to_country || 'България',
      is_to_person: buyer.is_to_person,
    }))
    setLookupOpen(false)
  }

  async function runLookup(q?: string) {
    const query = (q ?? lookupQuery).trim()
    if (query.length < 2) {
      toast({
        title: 'Type more',
        description: 'Enter at least 2 characters (name or EIK)',
        variant: 'destructive',
      })
      return
    }
    setLookupLoading(true)
    setLookupOpen(true)
    try {
      const res = await lookupInvBgBuyers(query)
      setMyClients(res.clients)
      setRegisterFirms(res.firms)
    } catch (error) {
      toast({
        title: 'Lookup failed',
        description: error instanceof Error ? error.message : 'Could not search inv.bg',
        variant: 'destructive',
      })
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleSelectMyClient(client: InvBgClient) {
    try {
      const buyer = await selectInvBgClientBuyer(client)
      applyBuyer(buyer)
      toast({ title: 'Buyer filled', description: client.name })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to select client',
        variant: 'destructive',
      })
    }
  }

  async function handleAddFromRegister(firm: InvBgRegisterFirm) {
    setAddingFirmId(firm.id)
    try {
      const { buyer } = await addRegisterFirmToInvBg(firm)
      applyBuyer(buyer)
      toast({
        title: 'Added to inv.bg clients',
        description: firm.name,
      })
    } catch (error) {
      toast({
        title: 'Could not add client',
        description: error instanceof Error ? error.message : 'Failed',
        variant: 'destructive',
      })
    } finally {
      setAddingFirmId(null)
    }
  }

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
          Search your inv.bg clients or Търговски регистър, then confirm line items.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Company / Name *</label>
              <div className="flex gap-2">
                <Input
                  value={form.to_name}
                  onChange={(e) => {
                    setForm({ ...form, to_name: e.target.value })
                    setLookupQuery(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void runLookup()
                    }
                  }}
                  disabled={loading}
                  required
                  placeholder="Name or EIK…"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Search inv.bg clients + Търговски регистър"
                  disabled={loading || lookupLoading}
                  onClick={() => void runLookup()}
                >
                  {lookupLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {lookupOpen && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border bg-popover text-sm">
                  {lookupLoading ? (
                    <p className="px-3 py-3 text-muted-foreground">Searching…</p>
                  ) : (
                    <>
                      <div className="border-b px-3 py-2 font-medium bg-muted/40">
                        My inv.bg clients ({myClients.length})
                      </div>
                      {myClients.length === 0 ? (
                        <p className="px-3 py-2 text-muted-foreground">No matches in your clients</p>
                      ) : (
                        myClients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-accent"
                            onClick={() => void handleSelectMyClient(c)}
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {[c.bulstat, c.town, c.mol].filter(Boolean).join(' · ') || '—'}
                            </span>
                          </button>
                        ))
                      )}

                      <div className="border-y px-3 py-2 font-medium bg-muted/40">
                        Търговски регистър ({registerFirms.length})
                      </div>
                      {registerFirms.length === 0 ? (
                        <p className="px-3 py-2 text-muted-foreground">No register matches</p>
                      ) : (
                        registerFirms.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-accent"
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => void handleAddFromRegister(f)}
                              disabled={addingFirmId === f.id}
                            >
                              <span className="font-medium block truncate">{f.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {[f.bulstat, f.settlement || f.city, f.mol]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </span>
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              disabled={addingFirmId !== null}
                              onClick={() => void handleAddFromRegister(f)}
                              title="Add to my inv.bg clients and fill form"
                            >
                              {addingFirmId === f.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                                  Add
                                </>
                              )}
                            </Button>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              )}
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
