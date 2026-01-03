'use client'

import { useState } from 'react'
import { Offer } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { createPaymentRecord } from '@/app/actions/payments'
import { useToast } from '@/components/ui/toaster'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
interface PublicPaymentPageProps {
  offer: Offer
}

export function PublicPaymentPage({ offer }: PublicPaymentPageProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    country: '',
    payment_method: 'card' as 'card' | 'bank_transfer' | 'paypal',
  })

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name || !formData.email) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setPaymentStatus('processing')

    try {
      // In a real implementation, you would integrate with a payment provider here
      // For now, we'll simulate a payment and create a payment record
      
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Create payment record
      await createPaymentRecord({
        offer_id: offer.id,
        amount: offer.amount,
        currency: offer.currency,
        status: 'completed',
        payment_provider: offer.payment_provider || 'manual',
        payment_method: formData.payment_method,
        payment_id: `pay_${Date.now()}`,
        client_email: formData.email,
        client_name: formData.name,
        metadata: {
          address: formData.address,
          city: formData.city,
          country: formData.country,
        },
      })

      setPaymentStatus('success')
      toast({
        title: 'Success',
        description: 'Payment processed successfully!',
      })
    } catch (error) {
      setPaymentStatus('failed')
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Payment failed',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

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
            <p className="text-sm text-muted-foreground">
              You will receive a confirmation email at {formData.email}
            </p>
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
            <p className="text-muted-foreground mb-4">
              There was an error processing your payment. Please try again.
            </p>
            <Button onClick={() => setPaymentStatus('idle')}>
              Retry Payment
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{offer.title}</CardTitle>
            <CardDescription>
              {offer.description || 'Payment for offer'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold">{offer.amount} {offer.currency}</p>
              </div>
              {offer.valid_until && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valid until</p>
                  <p className="text-sm font-medium">{format(new Date(offer.valid_until), 'MMM d, yyyy')}</p>
                </div>
              )}
            </div>

            {offer.status === 'paid' ? (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mb-2">
                  Paid
                </Badge>
                <p className="text-sm text-muted-foreground">
                  This offer has already been paid.
                </p>
              </div>
            ) : (
              <form onSubmit={handlePayment} className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Billing Information</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="text-sm font-medium">
                        Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        disabled={loading}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="text-sm font-medium">
                        Email <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        disabled={loading}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <label htmlFor="address" className="text-sm font-medium">
                        Address
                      </label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        disabled={loading}
                        className="mt-1"
                        rows={2}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="city" className="text-sm font-medium">
                          City
                        </label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          disabled={loading}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label htmlFor="country" className="text-sm font-medium">
                          Country
                        </label>
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          disabled={loading}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="payment_method" className="text-sm font-medium">
                        Payment Method
                      </label>
                      <select
                        id="payment_method"
                        value={formData.payment_method}
                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                        disabled={loading}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="card">Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="paypal">PayPal</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || paymentStatus === 'processing'}
                  >
                    {loading || paymentStatus === 'processing' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing payment...
                      </>
                    ) : (
                      'Pay Now'
                    )}
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  By proceeding, you agree to our terms and conditions. Your payment information is secure.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


































