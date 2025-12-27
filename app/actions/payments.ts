'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Payment, PaymentStatus, PaymentProvider } from '@/types/database'

export async function getPaymentHistory(offerId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  // Verify user owns the offer
  const { data: offer } = await supabase
    .from('offers')
    .select('id')
    .eq('id', offerId)
    .eq('owner_id', user.id)
    .single()

  if (!offer) {
    return []
  }

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []) as Payment[]
}

export async function createPaymentRecord(data: {
  offer_id: string
  amount: number
  currency: string
  status: PaymentStatus
  payment_provider: PaymentProvider
  payment_id?: string
  payment_method?: string
  client_email?: string
  client_name?: string
  metadata?: Record<string, any>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Verify user owns the offer
  const { data: offer } = await supabase
    .from('offers')
    .select('id, owner_id')
    .eq('id', data.offer_id)
    .eq('owner_id', user.id)
    .single()

  if (!offer) {
    throw new Error('Offer not found')
  }

  const insertData: any = {
    ...data,
  }

  if (data.status === 'completed') {
    insertData.paid_at = new Date().toISOString()
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Update offer status if payment is completed
  if (data.status === 'completed') {
    await supabase
      .from('offers')
      .update({
        status: 'paid',
        payment_status: 'completed',
        paid_at: new Date().toISOString(),
        payment_id: data.payment_id || null,
        payment_method: data.payment_method || null,
      })
      .eq('id', data.offer_id)
  }

  revalidatePath(`/offers/${data.offer_id}`)
  revalidatePath('/offers')
  return payment as Payment
}

export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  paymentData?: {
    payment_id?: string
    metadata?: Record<string, any>
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Get payment to verify ownership
  const { data: payment } = await supabase
    .from('payments')
    .select('offer_id, offers!inner(owner_id)')
    .eq('id', paymentId)
    .single()

  if (!payment || (payment as any).offers.owner_id !== user.id) {
    throw new Error('Payment not found')
  }

  const updateData: any = {
    status,
  }

  if (status === 'completed') {
    updateData.paid_at = new Date().toISOString()
  }

  if (paymentData) {
    if (paymentData.payment_id) updateData.payment_id = paymentData.payment_id
    if (paymentData.metadata) updateData.metadata = paymentData.metadata
  }

  const { data: updatedPayment, error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', paymentId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Update offer status if payment is completed
  if (status === 'completed' && payment.offer_id) {
    await supabase
      .from('offers')
      .update({
        status: 'paid',
        payment_status: 'completed',
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment.offer_id)
  }

  revalidatePath(`/offers/${payment.offer_id}`)
  revalidatePath('/offers')
  return updatedPayment as Payment
}











