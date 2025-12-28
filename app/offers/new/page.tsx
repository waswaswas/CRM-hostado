'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayoutClient } from '@/components/layout/app-layout-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createOffer, updateOffer } from '@/app/actions/offers'
import { useToast } from '@/components/ui/toaster'
import { OfferStatus, PaymentProvider } from '@/types/database'
import { getClients } from '@/app/actions/clients'
import type { Client } from '@/types/database'
import { ArrowLeft } from 'lucide-react'

export default function NewOfferPage() {
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
    currency: 'BGN',
    status: 'draft' as OfferStatus,
    valid_until: '',
    notes: '',
    payment_enabled: true,
    payment_provider: 'stripe' as PaymentProvider,
  })

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

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount',
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
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        status: formData.status,
        valid_until: formData.valid_until || undefined,
        notes: formData.notes || undefined,
        payment_enabled: formData.payment_enabled,
        payment_provider: formData.payment_enabled ? formData.payment_provider : undefined,
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
                <Select
                  id="client_id"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  required
                  disabled={loading}
                >
                  <option value="">None</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.company ? `(${client.company})` : ''}
                    </option>
                  ))}
                </Select>
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
                    required
                    disabled={loading}
                    placeholder="0.00"
                  />
                </div>

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
                    <option value="BGN">BGN (Bulgarian Lev)</option>
                    <option value="EUR">EUR (Euro)</option>
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




















