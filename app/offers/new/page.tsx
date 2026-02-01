'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayoutClient } from '@/components/layout/app-layout-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createOffer } from '@/app/actions/offers'
import { useToast } from '@/components/ui/toaster'
import { OfferStatus, PaymentProvider } from '@/types/database'
import type { OfferLineItem, OfferRecipientSnapshot } from '@/types/database'
import { getClients, getClient } from '@/app/actions/clients'
import type { Client } from '@/types/database'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

const UNPUBLISH_DAYS_OPTIONS = [3, 7, 14, 30] as const
const emptyLineItem: OfferLineItem = { name: '', quantity: 1, unit_price: 0 }
const emptyRecipient: OfferRecipientSnapshot = {
  name: '', company: null, email: null, phone: null,
  address: null, city: null, tax_number: null, mol: null, client_type: null,
}

function NewOfferContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [formData, setFormData] = useState({
    client_id: searchParams.get('client_id') || '',
    title: '',
    description: '',
    amount: '',
    currency: 'EUR',
    status: 'draft' as OfferStatus,
    valid_until: '',
    notes: '',
    payment_enabled: true,
    payment_provider: 'stripe' as PaymentProvider,
    is_public: false,
    unpublish_after_days: 14,
  })
  const [lineItems, setLineItems] = useState<OfferLineItem[]>([{ ...emptyLineItem }])
  const [recipient, setRecipient] = useState<OfferRecipientSnapshot>({ ...emptyRecipient })

  useEffect(() => {
    async function loadClients() {
      try {
        const clientsData = await getClients()
        setClients(clientsData)
      } catch (error) {
        console.error('Failed to load clients:', error)
      }
    }
    loadClients()
  }, [])

  async function loadRecipientFromClient() {
    if (!formData.client_id) return
    try {
      const client = await getClient(formData.client_id)
      setRecipient({
        name: client.name || '',
        company: client.company ?? null,
        email: client.email ?? null,
        phone: client.phone ?? null,
        address: null,
        city: null,
        tax_number: null,
        mol: null,
        client_type: client.client_type ?? null,
      })
      toast({ title: 'Loaded', description: 'Recipient filled from client' })
    } catch {
      toast({ title: 'Error', description: 'Could not load client', variant: 'destructive' })
    }
  }

  const totalFromLines = lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const useLineItems = lineItems.some((i) => i.name.trim() && (i.quantity * i.unit_price) > 0)
  const amount = useLineItems ? totalFromLines : parseFloat(formData.amount) || 0

  function updateLineItem(index: number, patch: Partial<OfferLineItem>) {
    setLineItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }
  function addLineItem() {
    setLineItems((prev) => [...prev, { ...emptyLineItem }])
  }
  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.client_id) {
      toast({
        title: 'Error',
        description: 'Please select a client',
        variant: 'destructive',
      })
      return
    }

    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an offer title',
        variant: 'destructive',
      })
      return
    }

    if (!useLineItems && (!formData.amount || parseFloat(formData.amount) <= 0)) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount or add line items',
        variant: 'destructive',
      })
      return
    }
    if (useLineItems && lineItems.every((i) => !i.name.trim())) {
      toast({
        title: 'Error',
        description: 'Add at least one line item with a name',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const offer = await createOffer({
        client_id: formData.client_id,
        title: formData.title,
        description: formData.description || undefined,
        amount,
        currency: formData.currency,
        status: formData.status,
        valid_until: formData.valid_until || undefined,
        notes: formData.notes || undefined,
        payment_enabled: formData.payment_enabled,
        payment_provider: formData.payment_enabled ? formData.payment_provider : undefined,
        is_public: formData.is_public,
        unpublish_after_days: formData.is_public ? formData.unpublish_after_days : undefined,
        line_items: useLineItems ? lineItems.filter((i) => i.name.trim() && (i.quantity * i.unit_price) > 0) : undefined,
        recipient_snapshot: recipient.name.trim() ? recipient : undefined,
      })

      toast({
        title: 'Success',
        description: 'Offer created successfully',
      })

      router.push(`/offers/${offer.id}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create offer',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayoutClient>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">New Offer</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Offer</CardTitle>
            <CardDescription>Create a new offer for a client</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="client_id" className="text-sm font-medium">
                  Client <span className="text-destructive">*</span>
                </label>
                <div className="flex gap-2">
                  <Select
                    id="client_id"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    required
                    disabled={loading}
                    className="flex-1"
                  >
                    <option value="">None</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} {client.company ? `(${client.company})` : ''}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" variant="outline" onClick={loadRecipientFromClient} disabled={loading || !formData.client_id}>
                    Load recipient
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Create as</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="visibility"
                      checked={!formData.is_public}
                      onChange={() => setFormData({ ...formData, is_public: false })}
                      disabled={loading}
                    />
                    Internal
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="visibility"
                      checked={formData.is_public}
                      onChange={() => setFormData({ ...formData, is_public: true })}
                      disabled={loading}
                    />
                    Public (shareable link)
                  </label>
                </div>
                {formData.is_public && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-muted-foreground">Auto-unpublish after</span>
                    <Select
                      value={String(formData.unpublish_after_days)}
                      onChange={(e) => setFormData({ ...formData, unpublish_after_days: Number(e.target.value) })}
                      disabled={loading}
                      className="w-24"
                    >
                      {UNPUBLISH_DAYS_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d} days</option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Recipient (for document)</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Name" value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} disabled={loading} />
                  <Input placeholder="Company" value={recipient.company || ''} onChange={(e) => setRecipient({ ...recipient, company: e.target.value || null })} disabled={loading} />
                  <Input type="email" placeholder="Email" value={recipient.email || ''} onChange={(e) => setRecipient({ ...recipient, email: e.target.value || null })} disabled={loading} />
                  <Input placeholder="Phone" value={recipient.phone || ''} onChange={(e) => setRecipient({ ...recipient, phone: e.target.value || null })} disabled={loading} />
                  <Input placeholder="Address" value={recipient.address || ''} onChange={(e) => setRecipient({ ...recipient, address: e.target.value || null })} disabled={loading} className="sm:col-span-2" />
                  <Input placeholder="City" value={recipient.city || ''} onChange={(e) => setRecipient({ ...recipient, city: e.target.value || null })} disabled={loading} />
                  <Input placeholder="Tax number (EIK/Булстат)" value={recipient.tax_number || ''} onChange={(e) => setRecipient({ ...recipient, tax_number: e.target.value || null })} disabled={loading} />
                  <Input placeholder="MOL" value={recipient.mol || ''} onChange={(e) => setRecipient({ ...recipient, mol: e.target.value || null })} disabled={loading} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Line items (Артикул, Количество, Цена без ДДС)</label>
                {lineItems.map((item, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-end border p-2 rounded-md">
                    <Input placeholder="Артикул / Name" value={item.name} onChange={(e) => updateLineItem(i, { name: e.target.value })} disabled={loading} className="min-w-[140px]" />
                    <Input placeholder="Каталожен №" value={item.catalog_no || ''} onChange={(e) => updateLineItem(i, { catalog_no: e.target.value || undefined })} disabled={loading} className="w-24" />
                    <Input type="number" min={0.01} step={0.01} placeholder="Количество" value={item.quantity || ''} onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) || 0 })} disabled={loading} className="w-24" />
                    <Input type="number" min={0} step={0.01} placeholder="Цена без ДДС" value={item.unit_price || ''} onChange={(e) => updateLineItem(i, { unit_price: Number(e.target.value) || 0 })} disabled={loading} className="w-28" />
                    <span className="text-sm text-muted-foreground w-20">= {(item.quantity * item.unit_price).toFixed(2)}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLineItem(i)} disabled={loading || lineItems.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addLineItem} disabled={loading}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add line
                </Button>
                {useLineItems && <p className="text-sm font-medium">Total: {totalFromLines.toFixed(2)} {formData.currency}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Offer Title <span className="text-destructive">*</span>
                </label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  disabled={loading}
                  placeholder="Offer title"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={loading}
                  placeholder="Offer description"
                  rows={4}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {!useLineItems && (
                  <div className="space-y-2">
                    <label htmlFor="amount" className="text-sm font-medium">
                      Amount <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      disabled={loading}
                      placeholder="0.00"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="currency" className="text-sm font-medium">
                    Currency
                  </label>
                  <Select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    disabled={loading}
                  >
                    <option value="EUR">EUR (Euro)</option>
                    <option value="BGN">BGN (Bulgarian Lev)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="GBP">GBP (British Pound)</option>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="status" className="text-sm font-medium">
                    Status
                  </label>
                  <Select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as OfferStatus })}
                    disabled={loading}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="valid_until" className="text-sm font-medium">
                    Valid Until
                  </label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="notes" className="text-sm font-medium">
                  Notes
                </label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  disabled={loading}
                  placeholder="Internal notes"
                  rows={3}
                />
              </div>

              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="payment_enabled"
                    checked={formData.payment_enabled}
                    onChange={(e) => setFormData({ ...formData, payment_enabled: e.target.checked })}
                    disabled={loading}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="payment_enabled" className="text-sm font-medium">
                    Enable Payment
                  </label>
                </div>

                {formData.payment_enabled && (
                  <div className="space-y-2">
                    <label htmlFor="payment_provider" className="text-sm font-medium">
                      Payment Provider
                    </label>
                    <Select
                      id="payment_provider"
                      value={formData.payment_provider}
                      onChange={(e) => setFormData({ ...formData, payment_provider: e.target.value as PaymentProvider })}
                      disabled={loading}
                    >
                      <option value="stripe">Stripe</option>
                      <option value="epay">ePay.bg</option>
                      <option value="paypal">PayPal</option>
                      <option value="manual">Manual</option>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Offer'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayoutClient>
  )
}

export default function NewOfferPage() {
  return (
    <AppLayoutClient>
      <Suspense fallback={<div>Loading...</div>}>
        <NewOfferContent />
      </Suspense>
    </AppLayoutClient>
  )
}



































