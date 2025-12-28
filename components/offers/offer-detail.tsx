'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Offer } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { updateOffer, deleteOffer, generatePaymentLink, markOfferAsPaid, duplicateOffer } from '@/app/actions/offers'
import { getPaymentHistory } from '@/app/actions/payments'
import { useToast } from '@/components/ui/toaster'
import { format } from 'date-fns'
import { ArrowLeft, Copy, Trash2, Check, Edit, Plus } from 'lucide-react'
import Link from 'next/link'
import type { Payment } from '@/types/database'
import { getClient } from '@/app/actions/clients'
import type { Client } from '@/types/database'

interface OfferDetailProps {
  initialOffer: Offer
}

export function OfferDetail({ initialOffer }: OfferDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [offer, setOffer] = useState<Offer>(initialOffer)
  const [client, setClient] = useState<Client | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editValues, setEditValues] = useState({
    title: offer.title,
    description: offer.description || '',
    amount: offer.amount.toString(),
    currency: offer.currency,
    status: offer.status,
    valid_until: offer.valid_until ? format(new Date(offer.valid_until), 'yyyy-MM-dd') : '',
    notes: offer.notes || '',
    payment_enabled: offer.payment_enabled,
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [clientData, paymentsData] = await Promise.all([
          getClient(offer.client_id),
          getPaymentHistory(offer.id),
        ])
        setClient(clientData)
        setPayments(paymentsData)
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }
    loadData()
  }, [offer.id, offer.client_id])

  async function handleSave() {
    setLoading(true)
    try {
      const updated = await updateOffer(offer.id, {
        title: editValues.title,
        description: editValues.description || undefined,
        amount: parseFloat(editValues.amount),
        currency: editValues.currency,
        status: editValues.status as any,
        valid_until: editValues.valid_until || undefined,
        notes: editValues.notes || undefined,
        payment_enabled: editValues.payment_enabled,
      })
      setOffer(updated)
      setEditing(false)
      toast({
        title: 'Success',
        description: 'Offer updated successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update offer',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${offer.title}"?`)) {
      return
    }

    try {
      await deleteOffer(offer.id)
      toast({
        title: 'Success',
        description: 'Offer deleted successfully',
      })
      router.push('/offers')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete offer',
        variant: 'destructive',
      })
    }
  }

  async function handleCopyPaymentLink() {
    try {
      const link = await generatePaymentLink(offer.id)
      // Redirect user to the public payment page instead of using the clipboard API
      if (typeof window !== 'undefined') {
        window.open(link, '_blank')
      }
      toast({
        title: 'Success',
        description: 'Redirecting to payment page...',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate payment link',
        variant: 'destructive',
      })
    }
  }

  async function handleCopyPaymentLinkToClipboard() {
    try {
      const link = offer.payment_link || (await generatePaymentLink(offer.id))
      if (typeof navigator !== 'undefined' && navigator.clipboard && link) {
        await navigator.clipboard.writeText(link)
        toast({
          title: 'Success',
          description: 'Payment link copied to clipboard',
        })
      } else {
        toast({
          title: 'Error',
          description: 'Clipboard is not available in this browser',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to copy payment link',
        variant: 'destructive',
      })
    }
  }

  async function handleMarkAsPaid() {
    if (!confirm('Mark this offer as paid?')) {
      return
    }

    try {
      const updated = await markOfferAsPaid(offer.id)
      setOffer(updated)
      toast({
        title: 'Success',
        description: 'Offer marked as paid',
      })
      // Reload payments
      const paymentsData = await getPaymentHistory(offer.id)
      setPayments(paymentsData)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark offer as paid',
        variant: 'destructive',
      })
    }
  }

  function getStatusLabel(status: OfferStatus) {
    const statusLabels: Record<OfferStatus, string> = {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted',
      rejected: 'Rejected',
      expired: 'Expired',
      paid: 'Paid',
      pending_payment: 'Pending Payment',
    }
    return statusLabels[status] || status
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      case 'sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'expired':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      case 'pending_payment':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {editing ? (
            <Input
              value={editValues.title}
              onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
              className="text-3xl font-bold"
              autoFocus
            />
          ) : (
            <h1 className="text-3xl font-bold">{offer.title}</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {offer.payment_enabled && offer.payment_token && (
                <Button variant="outline" onClick={handleCopyPaymentLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Payment Link
                </Button>
              )}
              {offer.status !== 'paid' && (
                <Button variant="outline" onClick={handleMarkAsPaid}>
                  <Check className="h-4 w-4 mr-2" />
                  Mark as Paid
                </Button>
              )}
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => {
                setEditing(false)
                setEditValues({
                  title: offer.title,
                  description: offer.description || '',
                  amount: offer.amount.toString(),
                  currency: offer.currency,
                  status: offer.status,
                  valid_until: offer.valid_until ? format(new Date(offer.valid_until), 'yyyy-MM-dd') : '',
                  notes: offer.notes || '',
                  payment_enabled: offer.payment_enabled,
                })
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Offer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Client</label>
                <p className="mt-1">
                  {client ? (
                    <Link href={`/clients/${client.id}`} className="text-primary hover:underline">
                      {client.name}
                    </Link>
                  ) : (
                    'Loading...'
                  )}
                </p>
              </div>

              {editing ? (
                <>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={editValues.description}
                      onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Amount</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editValues.amount}
                        onChange={(e) => setEditValues({ ...editValues, amount: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Currency</label>
                      <Select
                        value={editValues.currency}
                        onChange={(e) => setEditValues({ ...editValues, currency: e.target.value })}
                        className="mt-1"
                      >
                        <option value="BGN">BGN</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={editValues.status}
                        onChange={(e) => setEditValues({ ...editValues, status: e.target.value as any })}
                        className="mt-1"
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="expired">Expired</option>
                        <option value="paid">Paid</option>
                        <option value="pending_payment">Pending Payment</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Valid Until</label>
                      <Input
                        type="date"
                        value={editValues.valid_until}
                        onChange={(e) => setEditValues({ ...editValues, valid_until: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Notes</label>
                    <Textarea
                      value={editValues.notes}
                      onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </>
              ) : (
                <>
                  {offer.description && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <p className="mt-1 whitespace-pre-wrap">{offer.description}</p>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Amount</label>
                      <p className="mt-1 text-2xl font-bold">{offer.amount} {offer.currency}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div className="mt-1">
                        <Badge className={getStatusColor(offer.status)}>
                          {getStatusLabel(offer.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {offer.valid_until && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Valid Until</label>
                      <p className="mt-1">{format(new Date(offer.valid_until), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  {offer.notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Notes</label>
                      <p className="mt-1 whitespace-pre-wrap">{offer.notes}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{payment.amount} {payment.currency}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(payment.created_at), 'MMM d, yyyy HH:mm')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.payment_provider} • {payment.payment_method || 'N/A'}
                        </p>
                      </div>
                      <Badge className={payment.status === 'completed' ? 'bg-green-100 text-green-800' : ''}>
                        {payment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {offer.payment_enabled ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Payment Status</label>
                    <div className="mt-1">
                      {offer.status === 'paid' || offer.payment_status === 'completed' ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Paid</Badge>
                      ) : offer.payment_status === 'pending' || offer.status === 'pending_payment' ? (
                        <Badge className="bg-orange-100 text-orange-800">Pending Payment</Badge>
                      ) : (
                        <Badge variant="outline">Not Paid</Badge>
                      )}
                    </div>
                  </div>
                  {offer.payment_link && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Payment Link</label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input value={offer.payment_link} readOnly className="text-xs" />
                        <Button size="sm" variant="outline" onClick={handleCopyPaymentLinkToClipboard}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Link href={offer.payment_link} target="_blank" className="text-sm text-primary hover:underline mt-2 block">
                        Open payment page →
                      </Link>
                    </div>
                  )}
                  {offer.paid_at && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Paid At</label>
                      <p className="mt-1 text-sm">{format(new Date(offer.paid_at), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Payment is disabled for this offer</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <label className="text-muted-foreground">Created</label>
                <p>{format(new Date(offer.created_at), 'MMM d, yyyy HH:mm')}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Last Updated</label>
                <p>{format(new Date(offer.updated_at), 'MMM d, yyyy HH:mm')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}




















