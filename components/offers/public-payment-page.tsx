'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Offer } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { createPaymentRecordByToken } from '@/app/actions/payments'
import { markOfferOpened, acceptOfferByToken, requestOfferCorrection } from '@/app/actions/offers'
import { useToast } from '@/components/ui/toaster'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, Loader2, ChevronDown, MessageSquare, Check, CreditCard } from 'lucide-react'

interface PublicPaymentPageProps {
  offer: Offer
  token: string
}

export function PublicPaymentPage({ offer, token }: PublicPaymentPageProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle')
  const [showPayForm, setShowPayForm] = useState(false)
  const [accepted, setAccepted] = useState(offer.status === 'accepted')
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionMessage, setCorrectionMessage] = useState('')
  const [correctionEmail, setCorrectionEmail] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    country: '',
    payment_method: 'card' as 'card' | 'bank_transfer' | 'paypal',
  })

  useEffect(() => {
    markOfferOpened(offer.id, token).catch(() => {})
  }, [offer.id, token])

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name || !formData.email) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setLoading(true)
    setPaymentStatus('processing')
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await createPaymentRecordByToken(token, {
        offer_id: offer.id,
        amount: offer.amount,
        currency: offer.currency,
        status: 'completed',
        payment_provider: offer.payment_provider || 'manual',
        payment_method: formData.payment_method,
        payment_id: `pay_${Date.now()}`,
        client_email: formData.email,
        client_name: formData.name,
        metadata: { address: formData.address, city: formData.city, country: formData.country },
      })
      setPaymentStatus('success')
      toast({ title: 'Success', description: 'Payment processed successfully!' })
    } catch (error) {
      setPaymentStatus('failed')
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Payment failed', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    try {
      await acceptOfferByToken(token)
      setAccepted(true)
      toast({ title: 'Success', description: 'Offer accepted. Thank you.' })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to accept', variant: 'destructive' })
    }
  }

  async function handleRequestCorrection(e: React.FormEvent) {
    e.preventDefault()
    if (!correctionMessage.trim() || !correctionEmail.trim()) {
      toast({ title: 'Error', description: 'Please enter message and email', variant: 'destructive' })
      return
    }
    try {
      const { ok } = await requestOfferCorrection(token, correctionMessage.trim(), correctionEmail.trim())
      if (ok) {
        toast({ title: 'Success', description: 'Correction request sent.' })
        setShowCorrectionModal(false)
        setCorrectionMessage('')
        setCorrectionEmail('')
      } else {
        toast({ title: 'Error', description: 'Failed to send request', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed', variant: 'destructive' })
    }
  }

  const lineItems = offer.line_items?.length ? offer.line_items : []
  const total = lineItems.length
    ? lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    : offer.amount

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Your payment of {offer.amount} {offer.currency} has been processed successfully.
            </p>
            <p className="text-sm text-muted-foreground">You will receive a confirmation email at {formData.email}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
            <p className="text-muted-foreground mb-4">There was an error processing your payment. Please try again.</p>
            <Button onClick={() => setPaymentStatus('idle')}>Retry Payment</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="mx-auto max-w-2xl flex items-center justify-between py-4 mb-6 border-b border-border">
        <Image src="/hostado-logo.png" alt="Hostado" width={200} height={56} className="h-14 w-auto object-contain" />
        <ThemeToggle />
      </header>
      <div className="mx-auto max-w-2xl space-y-6 pb-8">
        <Card>
          <CardHeader className="space-y-4 pb-2">
            <CardTitle className="text-2xl">{offer.title}</CardTitle>
            <CardDescription className="text-base mt-4">{offer.description || 'Offer details'}</CardDescription>
            <p className="text-sm text-muted-foreground mt-6">
              Recipient name: {offer.recipient_snapshot?.name || '—'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {lineItems.length > 0 ? (
              <>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left p-2 font-medium">Артикул / Name</th>
                        <th className="text-right p-2 font-medium">Количество</th>
                        <th className="text-right p-2 font-medium">Крайна цена</th>
                        <th className="text-right p-2 font-medium">Стойност</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{item.name}{item.catalog_no ? ` (${item.catalog_no})` : ''}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">{item.unit_price}</td>
                          <td className="p-2 text-right">{(item.quantity * item.unit_price).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-right font-medium">Общо: {total.toFixed(2)} {offer.currency}</p>
              </>
            ) : (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Обща стойност</p>
                <p className="text-2xl font-bold">{total.toFixed(2)} {offer.currency}</p>
              </div>
            )}

            {offer.valid_until && (
              <p className="text-sm text-muted-foreground">
                Valid until: {format(new Date(offer.valid_until), 'MMM d, yyyy')}
              </p>
            )}

            {offer.status === 'paid' ? (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mb-2">Paid</Badge>
                <p className="text-sm text-muted-foreground">This offer has already been paid.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCorrectionModal(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Request correction
                  </Button>
                  {!accepted && !offer.is_archived && (
                    <Button type="button" variant="outline" size="sm" onClick={handleAccept}>
                      <Check className="h-4 w-4 mr-2" />
                      Accept
                    </Button>
                  )}
                  {accepted && (
                    <div className="space-y-1">
                      <Badge className="bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300">Accepted</Badge>
                      <p className="text-sm text-muted-foreground">
                        Благодарим Ви за приемането на офертата, ще се свържем с Вас за уточняване на детайлите.
                      </p>
                    </div>
                  )}
                  {offer.payment_enabled && !showPayForm && (
                    <Button type="button" size="sm" onClick={() => setShowPayForm(true)}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay Now
                    </Button>
                  )}
                </div>

                {showCorrectionModal && (
                  <Card className="border-2 mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Request correction</CardTitle>
                      <CardDescription>Send a message to the offer owner.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleRequestCorrection} className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">Your email *</label>
                          <Input
                            type="email"
                            value={correctionEmail}
                            onChange={(e) => setCorrectionEmail(e.target.value)}
                            placeholder="email@example.com"
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Message *</label>
                          <Textarea
                            value={correctionMessage}
                            onChange={(e) => setCorrectionMessage(e.target.value)}
                            placeholder="Describe the correction you need..."
                            required
                            rows={4}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit">Send request</Button>
                          <Button type="button" variant="outline" onClick={() => setShowCorrectionModal(false)}>Cancel</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {offer.payment_enabled && showPayForm && (
                  <form onSubmit={handlePayment} className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-semibold">Billing Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="name" className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
                        <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={loading} className="mt-1" />
                      </div>
                      <div>
                        <label htmlFor="email" className="text-sm font-medium">Email <span className="text-destructive">*</span></label>
                        <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={loading} className="mt-1" />
                      </div>
                      <div>
                        <label htmlFor="address" className="text-sm font-medium">Address</label>
                        <Textarea id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} disabled={loading} className="mt-1" rows={2} />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="city" className="text-sm font-medium">City</label>
                          <Input id="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} disabled={loading} className="mt-1" />
                        </div>
                        <div>
                          <label htmlFor="country" className="text-sm font-medium">Country</label>
                          <Input id="country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} disabled={loading} className="mt-1" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="payment_method" className="text-sm font-medium">Payment Method</label>
                        <div className="relative">
                          <select
                            id="payment_method"
                            value={formData.payment_method}
                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                            disabled={loading}
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm appearance-none"
                          >
                            <option value="card">Card</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="paypal">PayPal</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 opacity-50" />
                        </div>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading || paymentStatus === 'processing'}>
                      {loading || paymentStatus === 'processing' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing payment...</> : 'Pay Now'}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">By proceeding, you agree to our terms. Your payment information is secure.</p>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
