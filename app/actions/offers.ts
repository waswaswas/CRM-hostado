'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Offer, OfferStatus, PaymentProvider } from '@/types/database'
import { randomBytes } from 'crypto'

export async function getOffers() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []) as Offer[]
}

export async function getOffer(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Offer not found')
    }
    throw new Error(error.message)
  }

  return data as Offer
}

export async function getOfferByToken(token: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('payment_token', token)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Offer not found')
    }
    throw new Error(error.message)
  }

  return data as Offer
}

export async function getOffersForClient(clientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('owner_id', user.id)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    // Gracefully handle missing table - this allows the app to work before migration
    if (error.message.includes('Could not find the table') || 
        error.message.includes('relation') || 
        error.message.includes('does not exist') ||
        error.code === '42P01') {
      console.warn('Offers table does not exist yet. Please run supabase/SETUP_OFFERS.sql')
      return []
    }
    console.error('Error loading offers:', error)
    throw new Error(error.message)
  }

  return (data || []) as Offer[]
}

export async function createOffer(data: {
  client_id: string
  title: string
  description?: string
  amount: number
  currency?: string
  status?: OfferStatus
  valid_until?: string
  notes?: string
  payment_enabled?: boolean
  payment_provider?: PaymentProvider
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Generate secure payment token
  const paymentToken = randomBytes(32).toString('hex')

  const insertData: any = {
    ...data,
    owner_id: user.id,
    currency: data.currency || 'BGN',
    status: data.status || 'draft',
    payment_enabled: data.payment_enabled !== false,
    payment_token: paymentToken,
  }

  const { data: offer, error } = await supabase
    .from('offers')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/offers')
  revalidatePath(`/offers/${offer.id}`)
  revalidatePath(`/clients/${data.client_id}`)
  return offer as Offer
}

export async function updateOffer(
  id: string,
  data: Partial<{
    title: string
    description: string
    amount: number
    currency: string
    status: OfferStatus
    valid_until: string
    notes: string
    payment_enabled: boolean
    payment_provider: PaymentProvider
  }>
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: offer, error } = await supabase
    .from('offers')
    .update(data)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/offers')
  revalidatePath(`/offers/${id}`)
  if (offer) {
    revalidatePath(`/clients/${offer.client_id}`)
  }
  return offer as Offer
}

export async function deleteOffer(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('offers')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/offers')
}

export async function duplicateOffer(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Get original offer
  const { data: original, error: fetchError } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (fetchError || !original) {
    throw new Error('Offer not found')
  }

  // Generate new payment token
  const paymentToken = randomBytes(32).toString('hex')

  // Create duplicate with new token and draft status
  const { data: duplicate, error: insertError } = await supabase
    .from('offers')
    .insert({
      owner_id: user.id,
      client_id: original.client_id,
      title: `${original.title} (Copy)`,
      description: original.description,
      amount: original.amount,
      currency: original.currency,
      status: 'draft',
      valid_until: original.valid_until,
      notes: original.notes,
      payment_enabled: original.payment_enabled,
      payment_provider: original.payment_provider,
      payment_token: paymentToken,
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }

  revalidatePath('/offers')
  return duplicate as Offer
}

export async function generatePaymentLink(offerId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Get offer
  const { data: offer, error: fetchError } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('owner_id', user.id)
    .single()

  if (fetchError || !offer) {
    throw new Error('Offer not found')
  }

  // Generate payment link if token exists
  if (offer.payment_token) {
    const paymentLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/offers/${offerId}/pay?token=${offer.payment_token}`
    
    const { error: updateError } = await supabase
      .from('offers')
      .update({ payment_link: paymentLink })
      .eq('id', offerId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    revalidatePath(`/offers/${offerId}`)
    return paymentLink
  }

  throw new Error('Payment token not found')
}

export async function markOfferAsPaid(offerId: string, paymentData?: {
  payment_method?: string
  payment_id?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const updateData: any = {
    status: 'paid',
    payment_status: 'completed',
    paid_at: new Date().toISOString(),
  }

  if (paymentData) {
    if (paymentData.payment_method) updateData.payment_method = paymentData.payment_method
    if (paymentData.payment_id) updateData.payment_id = paymentData.payment_id
  }

  const { data: offer, error } = await supabase
    .from('offers')
    .update(updateData)
    .eq('id', offerId)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Create payment record
  if (offer) {
    await supabase
      .from('payments')
      .insert({
        offer_id: offerId,
        amount: offer.amount,
        currency: offer.currency,
        status: 'completed',
        payment_provider: offer.payment_provider || 'manual',
        payment_method: paymentData?.payment_method || 'manual',
        payment_id: paymentData?.payment_id || null,
        paid_at: new Date().toISOString(),
      })
  }

  revalidatePath('/offers')
  revalidatePath(`/offers/${offerId}`)
  if (offer) {
    revalidatePath(`/clients/${offer.client_id}`)
  }
  return offer as Offer
}




























