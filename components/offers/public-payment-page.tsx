'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Offer } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { OfferCheckoutTheme } from '@/components/offers/offer-checkout-theme'
import { createPaymentRecordByToken } from '@/app/actions/payments'
import {
  markOfferOpened,
  acceptOfferByToken,
  requestOfferCorrection,
  registerBankTransferIntent,
} from '@/app/actions/offers'
import { useToast } from '@/components/ui/toaster'
import { format, differenceInDays } from 'date-fns'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  MessageSquare,
  Check,
  CreditCard,
  Lock,
  Users,
  ShieldCheck,
} from 'lucide-react'

interface PublicPaymentPageProps {
  offer: Offer
  token: string
}

const BANK_DETAILS = {
  company: 'Хостадо Сълушънс ООД',
  bank: 'УниКредит Булбанк АД',
  iban: 'BG29UNCR70001526284363',
  bic: 'UNCRBGSF',
}

export function PublicPaymentPage({ offer, token }: PublicPaymentPageProps) {
  const { toast } = useToast()
  const paymentSectionRef = useRef<HTMLDivElement>(null)
  const snapshot = offer.recipient_snapshot
  const hasKnownCustomer = Boolean(snapshot?.email?.trim())

  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<
    'idle' | 'processing' | 'success' | 'bank_success' | 'failed'
  >('idle')
  const [accepted, setAccepted] = useState(offer.status === 'accepted')
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionMessage, setCorrectionMessage] = useState('')
  const [correctionEmail, setCorrectionEmail] = useState(snapshot?.email || '')
  const [wantsInvoice, setWantsInvoice] = useState(false)
  const [formData, setFormData] = useState({
    name: snapshot?.name || '',
    email: snapshot?.email || '',
    company: snapshot?.company || '',
    tax_number: snapshot?.tax_number || '',
    mol: snapshot?.mol || '',
    address: snapshot?.address || '',
    city: snapshot?.city || '',
    payment_method: 'card' as 'card' | 'bank_transfer',
  })

  useEffect(() => {
    const key = `offer_opened_${offer.id}`
    if (typeof window !== 'undefined' && sessionStorage.getItem(key)) return
    markOfferOpened(offer.id, token)
      .then(() => {
        if (typeof window !== 'undefined') sessionStorage.setItem(key, '1')
      })
      .catch(() => {})
  }, [offer.id, token])

  const lineItems = offer.line_items?.length ? offer.line_items : []
  const total = lineItems.length
    ? lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    : offer.amount

  const linkExpiresDays =
    offer.published_at && offer.unpublish_after_days
      ? Math.max(
          0,
          offer.unpublish_after_days -
            differenceInDays(new Date(), new Date(offer.published_at))
        )
      : null

  function getSubmitNameEmail() {
    return {
      name: hasKnownCustomer ? (snapshot?.name || formData.name) : formData.name,
      email: hasKnownCustomer ? (snapshot?.email || formData.email) : formData.email,
    }
  }

  function validateInvoice(): boolean {
    if (!wantsInvoice) return true
    if (!formData.company.trim() || !formData.tax_number.trim() || !formData.mol.trim() || !formData.address.trim() || !formData.city.trim()) {
      toast({ title: 'Error', description: 'Моля, попълнете всички полета за фактура', variant: 'destructive' })
      return false
    }
    return true
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    const { name, email } = getSubmitNameEmail()
    if (!name || !email) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    if (!validateInvoice()) return

    if (formData.payment_method === 'bank_transfer') {
      setLoading(true)
      try {
        const invoice = wantsInvoice
          ? {
              company: formData.company.trim(),
              tax_number: formData.tax_number.trim(),
              mol: formData.mol.trim(),
              address: formData.address.trim(),
              city: formData.city.trim(),
            }
          : null
        const { ok } = await registerBankTransferIntent(token, invoice)
        if (ok) {
          setPaymentStatus('bank_success')
        } else {
          toast({ title: 'Error', description: 'Failed to register bank transfer', variant: 'destructive' })
        }
      } catch (error) {
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    setPaymentStatus('processing')
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await createPaymentRecordByToken(token, {
        offer_id: offer.id,
        amount: offer.amount,
        currency: offer.currency,
        status: 'completed',
        payment_provider: offer.payment_provider || 'manual',
        payment_method: formData.payment_method,
        payment_id: `pay_${Date.now()}`,
        client_email: email,
        client_name: name,
        metadata: {
          ...(wantsInvoice
            ? {
                invoice: {
                  company: formData.company.trim(),
                  tax_number: formData.tax_number.trim(),
                  mol: formData.mol.trim(),
                  address: formData.address.trim(),
                  city: formData.city.trim(),
                },
              }
            : {}),
        },
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
      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
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
        if (!hasKnownCustomer) setCorrectionEmail('')
      } else {
        toast({ title: 'Error', description: 'Failed to send request', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed', variant: 'destructive' })
    }
  }

  const successEmail = getSubmitNameEmail().email

  if (paymentStatus === 'success') {
    return (
      <OfferCheckoutTheme>
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
              <p className="text-muted-foreground mb-4">
                Your payment of {offer.amount} {offer.currency} has been processed successfully.
              </p>
              {successEmail && (
                <p className="text-sm text-muted-foreground">You will receive a confirmation email at {successEmail}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </OfferCheckoutTheme>
    )
  }

  if (paymentStatus === 'bank_success') {
    return (
      <OfferCheckoutTheme>
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center space-y-3">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Инструкциите са записани</h2>
              <p className="text-muted-foreground">
                Моля, направете превода по данните по-долу и ще потвърдим плащането.
              </p>
              <div className="text-left text-sm border rounded-md p-4 bg-muted/50 space-y-1">
                <p className="font-semibold">{BANK_DETAILS.company}</p>
                <p>Банка: {BANK_DETAILS.bank}</p>
                <p>IBAN: {BANK_DETAILS.iban}</p>
                <p>BIC/SWIFT: {BANK_DETAILS.bic}</p>
                <p className="pt-2">Оферта: {offer.title}</p>
                <p>Сума: {total.toFixed(2)} {offer.currency}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </OfferCheckoutTheme>
    )
  }

  if (paymentStatus === 'failed') {
    return (
      <OfferCheckoutTheme>
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
              <p className="text-muted-foreground mb-4">There was an error processing your payment. Please try again.</p>
              <Button onClick={() => setPaymentStatus('idle')}>Retry Payment</Button>
            </CardContent>
          </Card>
        </div>
      </OfferCheckoutTheme>
    )
  }

  const showPaymentForm = offer.payment_enabled && offer.status !== 'paid' && offer.status !== 'pending_payment'

  return (
    <OfferCheckoutTheme>
      <div className="p-4 pb-24">
        <header className="mx-auto max-w-2xl py-4 mb-4 border-b border-border">
          <Image src="/hostado-logo.png" alt="Hostado" width={200} height={56} className="h-14 w-auto object-contain" />
        </header>

        <div className="mx-auto max-w-2xl mb-6 flex flex-wrap gap-4 justify-center text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            100% secure payment
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            150+ happy customers
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            DUNS registered
          </span>
        </div>

        <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground mb-6">
          Trusted by 150+ businesses across Bulgaria and EU
        </p>

        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader className="space-y-4 pb-2">
              <CardTitle className="text-2xl">{offer.title}</CardTitle>
              <CardDescription className="text-base mt-4">{offer.description || 'Offer details'}</CardDescription>
              <p className="text-sm text-muted-foreground mt-6">
                Recipient name: {snapshot?.name || '—'}
              </p>
              {(offer.valid_until || linkExpiresDays !== null) && (
                <div className="flex flex-wrap gap-3 text-sm">
                  {offer.valid_until && (
                    <Badge variant="outline">Valid until {format(new Date(offer.valid_until), 'MMM d, yyyy')}</Badge>
                  )}
                  {linkExpiresDays !== null && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
                      Link expires in {linkExpiresDays} day{linkExpiresDays === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
              )}
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
                  <p className="text-right font-medium text-lg">Общо: {total.toFixed(2)} {offer.currency}</p>
                </>
              ) : (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Обща стойност</p>
                  <p className="text-2xl font-bold">{total.toFixed(2)} {offer.currency}</p>
                </div>
              )}

              {offer.status === 'paid' ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mb-2">Paid</Badge>
                  <p className="text-sm text-muted-foreground">This offer has already been paid.</p>
                </div>
              ) : offer.status === 'pending_payment' ? (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center space-y-2">
                  <Badge className="bg-orange-100 text-orange-800">Pending bank transfer</Badge>
                  <p className="text-sm text-muted-foreground">Awaiting payment confirmation from Hostado.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                    {!accepted && !offer.is_archived && (
                      <Button type="button" size="sm" onClick={handleAccept}>
                        <Check className="h-4 w-4 mr-2" />
                        Accept offer
                      </Button>
                    )}
                    {accepted && (
                      <div className="space-y-1 w-full">
                        <Badge className="bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300">Accepted</Badge>
                        <p className="text-sm text-muted-foreground">
                          Почти готово — завършете плащането по-долу, за да започнем.
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                      onClick={() => setShowCorrectionModal(true)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 inline mr-1" />
                      Request correction
                    </button>
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
                              readOnly={hasKnownCustomer}
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

                  {showPaymentForm && (
                    <div ref={paymentSectionRef} className="pt-4 border-t">
                      <form onSubmit={handlePayment} className="space-y-4">
                        <h3 className="text-lg font-semibold">Payment</h3>

                        {hasKnownCustomer ? (
                          <p className="text-sm bg-muted/50 rounded-md p-3">
                            Paying as <strong>{snapshot?.name}</strong> ({snapshot?.email})
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label htmlFor="name" className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
                              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={loading} className="mt-1" />
                            </div>
                            <div>
                              <label htmlFor="email" className="text-sm font-medium">Email <span className="text-destructive">*</span></label>
                              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={loading} className="mt-1" />
                            </div>
                          </div>
                        )}

                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wantsInvoice}
                            onChange={(e) => setWantsInvoice(e.target.checked)}
                            disabled={loading}
                            className="rounded"
                          />
                          I want an invoice / Искам фактура
                        </label>

                        {wantsInvoice && (
                          <div className="space-y-3 border rounded-md p-4 bg-muted/30">
                            <div>
                              <label className="text-sm font-medium">Фирма / Company name *</label>
                              <Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} required={wantsInvoice} disabled={loading} className="mt-1" />
                            </div>
                            <div>
                              <label className="text-sm font-medium">ЕИК / Булстат *</label>
                              <Input value={formData.tax_number} onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })} required={wantsInvoice} disabled={loading} className="mt-1" />
                            </div>
                            <div>
                              <label className="text-sm font-medium">МОЛ *</label>
                              <Input value={formData.mol} onChange={(e) => setFormData({ ...formData, mol: e.target.value })} required={wantsInvoice} disabled={loading} className="mt-1" />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Адрес *</label>
                              <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required={wantsInvoice} disabled={loading} className="mt-1" rows={2} />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Град *</label>
                              <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} required={wantsInvoice} disabled={loading} className="mt-1" />
                            </div>
                          </div>
                        )}

                        <div>
                          <label htmlFor="payment_method" className="text-sm font-medium">Payment Method</label>
                          <div className="relative">
                            <select
                              id="payment_method"
                              value={formData.payment_method}
                              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as 'card' | 'bank_transfer' })}
                              disabled={loading}
                              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm appearance-none"
                            >
                              <option value="card">Card</option>
                              <option value="bank_transfer">Bank Transfer</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 opacity-50" />
                          </div>
                          {formData.payment_method === 'bank_transfer' && (
                            <p className="text-xs text-muted-foreground mt-1">No fees · Pay directly from your bank</p>
                          )}
                        </div>

                        {formData.payment_method === 'bank_transfer' && (
                          <div className="rounded-md border p-4 bg-muted/40 text-sm space-y-1">
                            <p className="font-semibold text-base">{BANK_DETAILS.company}</p>
                            <p>Банка: {BANK_DETAILS.bank}</p>
                            <p>IBAN: {BANK_DETAILS.iban}</p>
                            <p>BIC/SWIFT: {BANK_DETAILS.bic}</p>
                            <p className="pt-2 text-muted-foreground">Оферта: {offer.title} / {offer.id}</p>
                            <p className="text-muted-foreground">Сума: {total.toFixed(2)} {offer.currency}</p>
                          </div>
                        )}

                        <Button type="submit" className="w-full hidden sm:flex" size="lg" disabled={loading || paymentStatus === 'processing'}>
                          {loading || paymentStatus === 'processing' ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                          ) : formData.payment_method === 'bank_transfer' ? (
                            'Потвърждавам, че ще направя превод'
                          ) : (
                            <><CreditCard className="mr-2 h-4 w-4" />Pay Now — {total.toFixed(2)} {offer.currency}</>
                          )}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground hidden sm:block">
                          100% secure payment. By proceeding, you agree to our terms.
                        </p>
                      </form>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {showPaymentForm && (
          <div className="fixed bottom-0 left-0 right-0 p-4 border-t bg-background/95 backdrop-blur sm:hidden z-50">
            <Button
              type="submit"
              form=""
              className="w-full"
              size="lg"
              disabled={loading}
              onClick={(e) => {
                e.preventDefault()
                const form = paymentSectionRef.current?.querySelector('form')
                form?.requestSubmit()
              }}
            >
              {formData.payment_method === 'bank_transfer'
                ? 'Потвърждавам превод'
                : `Pay ${total.toFixed(2)} ${offer.currency}`}
            </Button>
          </div>
        )}
      </div>
    </OfferCheckoutTheme>
  )
}
