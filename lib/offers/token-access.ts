import { createAdminClient, getAdminConfigError } from '@/lib/supabase/admin'
import type { Offer, OfferMetadata } from '@/types/database'
import { normalizeOfferRow } from '@/lib/offers/normalize'

export function isOfferPubliclyAccessible(offer: Offer): boolean {
  if (!offer.is_public || !offer.is_published) return false
  const publishedAt = offer.published_at
  const days = Number(offer.unpublish_after_days ?? 14)
  if (publishedAt && days > 0) {
    const unpublishAt = new Date(publishedAt)
    unpublishAt.setDate(unpublishAt.getDate() + days)
    if (unpublishAt <= new Date()) return false
  }
  return true
}

/** Fetch and validate offer by payment token. Uses service role after token match. */
export async function getOfferByPaymentToken(
  token: string,
  offerId?: string
): Promise<Offer> {
  const adminErr = getAdminConfigError()
  if (adminErr) throw new Error(adminErr)

  const admin = createAdminClient()
  if (!admin) throw new Error('Admin client unavailable')

  const { data, error } = await admin
    .from('offers')
    .select('*')
    .eq('payment_token', token)
    .single()

  if (error || !data) {
    throw new Error('Offer not found')
  }

  const offer = normalizeOfferRow(data as Record<string, unknown>)
  if (offerId && offer.id !== offerId) {
    throw new Error('Offer not found')
  }
  if (!isOfferPubliclyAccessible(offer)) {
    throw new Error('Offer not found')
  }
  return offer
}

export async function updateOfferMetadataByToken(
  token: string,
  offerId: string,
  patch: Partial<OfferMetadata> & Record<string, unknown>
): Promise<void> {
  const offer = await getOfferByPaymentToken(token, offerId)
  const admin = createAdminClient()
  if (!admin) throw new Error('Admin client unavailable')

  const meta = (offer.metadata as OfferMetadata) || {}
  const nextMeta = { ...meta, ...patch }

  const { error } = await admin
    .from('offers')
    .update({ metadata: nextMeta })
    .eq('id', offerId)
    .eq('payment_token', token)

  if (error) throw new Error(error.message)
}
