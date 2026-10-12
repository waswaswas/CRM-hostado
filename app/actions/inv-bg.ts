'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationId } from '@/app/actions/organizations'
import { revalidatePath } from 'next/cache'
import {
  createProforma,
  isInvBgConfigured,
  type InvBgProformaCreateInput,
  type InvBgProformaResult,
} from '@/lib/inv-bg/client'
import type { Offer, OfferMetadata } from '@/types/database'
import { normalizeOfferRow } from '@/lib/offers/normalize'
import type { ProformaFormPayload } from '@/lib/inv-bg/types'

export type { ProformaFormPayload }

export async function getInvBgStatus(): Promise<{ configured: boolean }> {
  return { configured: isInvBgConfigured() }
}

function toInvInput(payload: ProformaFormPayload): InvBgProformaCreateInput {
  return {
    to_name: payload.to_name,
    to_town: payload.to_town,
    to_address: payload.to_address,
    to_bulstat: payload.to_bulstat,
    to_mol: payload.to_mol,
    to_vat_number: payload.to_vat_number,
    to_country: payload.to_country,
    to_email: payload.to_email,
    is_to_person: payload.is_to_person,
    payment_currency: payload.payment_currency,
    notes: payload.notes,
    vat_percent: payload.vat_percent,
    items: payload.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.unit_price,
      quantity_unit: i.quantity_unit || 'бр.',
    })),
  }
}

async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) throw new Error('No organization selected')
  return { supabase, user, organizationId }
}

async function saveProformaOnOffer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  organizationId: string,
  offerId: string,
  result: InvBgProformaResult
) {
  const { data: current, error: fetchErr } = await supabase
    .from('offers')
    .select('metadata, client_id')
    .eq('id', offerId)
    .eq('owner_id', userId)
    .eq('organization_id', organizationId)
    .single()

  if (fetchErr || !current) {
    throw new Error(fetchErr?.message || 'Offer not found')
  }

  const meta = ((current.metadata as OfferMetadata) || {}) as OfferMetadata
  const nextMeta: OfferMetadata = {
    ...meta,
    inv_bg_proforma: {
      id: result.id,
      number: result.number,
      url: result.url,
      created_at: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from('offers')
    .update({ metadata: nextMeta })
    .eq('id', offerId)
    .eq('owner_id', userId)
    .eq('organization_id', organizationId)

  if (error) throw new Error(error.message)

  revalidatePath(`/offers/${offerId}`)
  revalidatePath('/offers')
  if (current.client_id) {
    revalidatePath(`/clients/${current.client_id}`)
  }

  return nextMeta.inv_bg_proforma!
}

export async function createInvBgProformaFromOffer(
  offerId: string,
  payload: ProformaFormPayload
): Promise<{
  proforma: InvBgProformaResult
  sync: NonNullable<OfferMetadata['inv_bg_proforma']>
  offer: Offer
}> {
  if (!isInvBgConfigured()) {
    throw new Error('inv.bg is not configured (missing INV_BG_API_TOKEN)')
  }

  const { supabase, user, organizationId } = await requireAuth()

  const { data: row, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()

  if (error || !row) {
    throw new Error(error?.message || 'Offer not found')
  }

  const result = await createProforma(toInvInput(payload))
  const sync = await saveProformaOnOffer(supabase, user.id, organizationId, offerId, result)

  const { data: updated } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .single()

  return {
    proforma: result,
    sync,
    offer: normalizeOfferRow((updated || row) as Record<string, unknown>) as Offer,
  }
}

export async function createInvBgProformaFromClient(
  clientId: string,
  payload: ProformaFormPayload
): Promise<{
  proforma: InvBgProformaResult
  sync: NonNullable<OfferMetadata['inv_bg_proforma']> | null
  attached_offer_id: string | null
}> {
  if (!isInvBgConfigured()) {
    throw new Error('inv.bg is not configured (missing INV_BG_API_TOKEN)')
  }

  const { supabase, user, organizationId } = await requireAuth()

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('organization_id', organizationId)
    .eq('is_deleted', false)
    .single()

  if (clientErr || !client) {
    throw new Error(clientErr?.message || 'Client not found')
  }

  const result = await createProforma(toInvInput(payload))

  let attachOfferId = payload.attach_offer_id || null
  if (!attachOfferId) {
    const { data: latest } = await supabase
      .from('offers')
      .select('id')
      .eq('client_id', clientId)
      .eq('owner_id', user.id)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    attachOfferId = latest?.id || null
  }

  let sync: NonNullable<OfferMetadata['inv_bg_proforma']> | null = null
  if (attachOfferId) {
    sync = await saveProformaOnOffer(supabase, user.id, organizationId, attachOfferId, result)
  }

  revalidatePath(`/clients/${clientId}`)
  return { proforma: result, sync, attached_offer_id: attachOfferId }
}
