'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Offer, OfferMetadata, OfferStatus, PaymentProvider } from '@/types/database'
import { randomBytes } from 'crypto'
import { getCurrentOrganizationId } from './organizations'

/** Flatten metadata onto offer for app use. Handles missing metadata column. */
function normalizeOffer(row: Record<string, unknown> | null | undefined): Offer {
  if (!row || typeof row !== 'object') {
    throw new Error('Invalid offer row')
  }
  const meta = (row.metadata as OfferMetadata | null) || {}
  return {
    ...row,
    metadata: meta,
    is_public: meta.is_public ?? false,
    is_published: meta.is_published ?? false,
    published_at: meta.published_at ?? null,
    unpublish_after_days: meta.unpublish_after_days ?? null,
    is_archived: meta.is_archived ?? false,
    line_items: meta.line_items ?? [],
    recipient_snapshot: meta.recipient_snapshot ?? null,
  } as Offer
}

export async function getOffers(options?: { includeArchived?: boolean }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('getOffers error:', error.message)
    return []
  }

  const rows = Array.isArray(data) ? data : []
  let list: Offer[] = []
  try {
    list = rows.map((r) => normalizeOffer(r as Record<string, unknown>)) as Offer[]
  } catch (e) {
    console.warn('getOffers normalize error:', e)
    return []
  }
  if (!options?.includeArchived) {
    list = list.filter((o) => !o.is_archived)
  }
  return list
}

export async function getOffer(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Offer not found')
    }
    throw new Error(error.message)
  }

  return normalizeOffer(data) as Offer
}

export async function getOfferByToken(token: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('payment_token', token)
    .single()

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      throw new Error('Offer not found')
    }
    throw new Error(error?.message ?? 'Offer not found')
  }

  const offer = normalizeOffer(data) as Offer
  if (!offer.is_public || !offer.is_published) {
    throw new Error('Offer not found')
  }
  return offer
}

export async function getOffersForClient(clientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
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

  return ((data || []) as Record<string, unknown>[]).map(normalizeOffer) as Offer[]
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
  is_public?: boolean
  unpublish_after_days?: number
  line_items?: { name: string; quantity: number; unit_price: number; catalog_no?: string }[]
  recipient_snapshot?: Offer['recipient_snapshot']
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const paymentToken = randomBytes(32).toString('hex')
  const lineItems = data.line_items?.length ? data.line_items : undefined
  const amount = lineItems?.length
    ? lineItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
    : data.amount

  const metadata: OfferMetadata = {
    is_public: data.is_public ?? false,
    is_published: false,
    unpublish_after_days: data.unpublish_after_days ?? 14,
    is_archived: false,
    line_items: lineItems ?? [],
    recipient_snapshot: data.recipient_snapshot ?? null,
  }

  const insertData: Record<string, unknown> = {
    client_id: data.client_id,
    title: data.title,
    description: data.description ?? null,
    amount,
    currency: data.currency ?? 'EUR',
    status: data.status ?? 'draft',
    valid_until: data.valid_until ?? null,
    notes: data.notes ?? null,
    owner_id: user.id,
    organization_id: organizationId,
    payment_enabled: data.payment_enabled !== false,
    payment_token: paymentToken,
    metadata,
  }

  const { data: offer, error } = await supabase
    .from('offers')
    .insert(insertData)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/offers')
  revalidatePath(`/offers/${offer.id}`)
  revalidatePath(`/clients/${data.client_id}`)
  return normalizeOffer(offer) as Offer
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
    unpublish_after_days: number
    line_items: Offer['line_items']
    recipient_snapshot: Offer['recipient_snapshot']
  }>
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const hasMeta = data.unpublish_after_days !== undefined || data.line_items !== undefined || data.recipient_snapshot !== undefined
  let updatePayload: Record<string, unknown> = { ...data }
  delete (updatePayload as Record<string, unknown>).line_items
  delete (updatePayload as Record<string, unknown>).recipient_snapshot
  delete (updatePayload as Record<string, unknown>).unpublish_after_days

  if (hasMeta) {
    const { data: current } = await supabase
      .from('offers')
      .select('metadata')
      .eq('id', id)
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)
      .single()
    const meta = (current?.metadata as OfferMetadata) || {}
    if (data.unpublish_after_days !== undefined) meta.unpublish_after_days = data.unpublish_after_days
    if (data.line_items !== undefined) meta.line_items = data.line_items
    if (data.recipient_snapshot !== undefined) meta.recipient_snapshot = data.recipient_snapshot
    updatePayload.metadata = meta
  }

  const { data: offer, error } = await supabase
    .from('offers')
    .update(updatePayload)
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/offers')
  revalidatePath(`/offers/${id}`)
  if (offer) {
    revalidatePath(`/clients/${(offer as Offer).client_id}`)
  }
  return normalizeOffer(offer) as Offer
}

export async function toggleOfferPublished(id: string): Promise<Offer> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) throw new Error('No organization selected')

  const { data: row, error: fetchErr } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()
  if (fetchErr || !row) throw new Error('Offer not found')

  const meta = (row.metadata as OfferMetadata) || {}
  const nextPublished = !meta.is_published
  const nextMeta: OfferMetadata = {
    ...meta,
    is_public: meta.is_public ?? false,
    is_published: nextPublished,
    published_at: nextPublished ? new Date().toISOString() : (meta.published_at ?? undefined),
    unpublish_after_days: meta.unpublish_after_days ?? 14,
  }

  const { data: offer, error } = await supabase
    .from('offers')
    .update({ metadata: nextMeta })
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/offers')
  revalidatePath(`/offers/${id}`)
  return normalizeOffer(offer) as Offer
}

export async function archiveOffer(id: string): Promise<Offer> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) throw new Error('No organization selected')

  const { data: row, error: fetchErr } = await supabase
    .from('offers')
    .select('metadata')
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()
  if (fetchErr || !row) throw new Error('Offer not found')

  const meta = (row.metadata as OfferMetadata) || {}
  const nextMeta: OfferMetadata = { ...meta, is_archived: true }

  const { data: offer, error } = await supabase
    .from('offers')
    .update({ metadata: nextMeta })
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/offers')
  revalidatePath(`/offers/${id}`)
  return normalizeOffer(offer) as Offer
}

export async function restoreOffer(id: string): Promise<Offer> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) throw new Error('No organization selected')

  const { data: row, error: fetchErr } = await supabase
    .from('offers')
    .select('metadata')
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()
  if (fetchErr || !row) throw new Error('Offer not found')

  const meta = (row.metadata as OfferMetadata) || {}
  const nextMeta: OfferMetadata = { ...meta, is_archived: false }

  const { data: offer, error } = await supabase
    .from('offers')
    .update({ metadata: nextMeta })
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/offers')
  revalidatePath(`/offers/${id}`)
  return normalizeOffer(offer) as Offer
}

export async function deleteOffer(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  const { error } = await supabase
    .from('offers')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)

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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  // Get original offer
  const { data: original, error: fetchError } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  if (fetchError || !original) {
    throw new Error('Offer not found')
  }

  // Generate new payment token
  const paymentToken = randomBytes(32).toString('hex')

  const meta = (original.metadata as OfferMetadata) || {}
  const dupMeta: OfferMetadata = {
    is_public: meta.is_public,
    is_published: false,
    published_at: undefined,
    unpublish_after_days: meta.unpublish_after_days ?? 14,
    is_archived: false,
    line_items: meta.line_items ?? [],
    recipient_snapshot: meta.recipient_snapshot ?? null,
  }

  const { data: duplicate, error: insertError } = await supabase
    .from('offers')
    .insert({
      owner_id: user.id,
      organization_id: organizationId,
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
      metadata: dupMeta,
    })
    .select('*')
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }

  revalidatePath('/offers')
  return normalizeOffer(duplicate) as Offer
}

export async function generatePaymentLink(offerId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
  }

  // Get offer
  const { data: offer, error: fetchError } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
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

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error('No organization selected')
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
    .eq('organization_id', organizationId)
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





























