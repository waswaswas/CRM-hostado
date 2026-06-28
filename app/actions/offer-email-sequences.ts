'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { renderTemplate } from '@/lib/email-template-utils'
import { sendEmail } from '@/lib/email-provider'
import { getOrganizationEmailConfigForSendingById } from './organizations'
import type { Offer } from '@/types/database'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getCurrentOrganizationId } from './organizations'
import { normalizeOfferRow } from '@/lib/offers/normalize'
import {
  buildOfferEmailVariables,
  computeNextSendAt,
  getDefaultOfferSequenceSteps,
  type OfferSequenceStep,
} from '@/lib/offers/email-sequence-steps'

async function getAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') || h.get('host')
    const proto = h.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
    if (host) return `${proto}://${host}`
  } catch {
    // ignore
  }
  return process.env.NODE_ENV === 'production' ? 'https://gms.hostado.net' : 'http://localhost:3000'
}

export interface OfferEmailEnrollment {
  id: string
  offer_id: string
  client_id: string
  organization_id: string
  owner_id: string
  current_step: number
  status: 'active' | 'completed' | 'stopped'
  next_send_at: string | null
  last_sent_at: string | null
  created_at: string
}

async function sendSequenceEmail(
  offer: Offer,
  step: OfferSequenceStep,
  toEmail: string,
  toName: string
): Promise<boolean> {
  const admin = createAdminClient()
  if (!admin) return false

  const baseUrl = await getAppBaseUrl()
  const vars = buildOfferEmailVariables(offer, baseUrl)
  const subject = renderTemplate(step.subject, vars)
  const bodyHtml = renderTemplate(step.bodyHtml, vars)

  const orgId = (offer as Offer & { organization_id?: string }).organization_id
  const orgConfig = orgId ? await getOrganizationEmailConfigForSendingById(orgId) : null

  const result = await sendEmail(
    {
      to: toEmail,
      toName,
      subject,
      html: bodyHtml,
      text: bodyHtml.replace(/<[^>]+>/g, ''),
    },
    orgConfig?.config ?? null
  )

  if (!result.success) return false

  await admin.from('emails').insert({
    owner_id: offer.owner_id,
    organization_id: orgId,
    client_id: offer.client_id,
    subject,
    body_html: bodyHtml,
    body_text: bodyHtml.replace(/<[^>]+>/g, ''),
    from_email: orgConfig?.config?.from.email || process.env.SMTP_FROM_EMAIL || 'noreply@hostado.net',
    from_name: orgConfig?.config?.from.name || process.env.SMTP_FROM_NAME || 'Hostado',
    to_email: toEmail,
    to_name: toName,
    status: 'sent',
    sent_at: new Date().toISOString(),
    folder: 'sent',
    direction: 'outbound',
    metadata: { offer_id: offer.id, sequence_step: step.step },
  })

  return true
}

export async function enrollOfferInEmailSequence(offer: Offer): Promise<void> {
  const toEmail = offer.recipient_snapshot?.email
  if (!toEmail) return

  const admin = createAdminClient()
  if (!admin) return

  const orgId = (offer as Offer & { organization_id?: string }).organization_id
  if (!orgId) return

  const steps = getDefaultOfferSequenceSteps()
  const step0 = steps[0]
  const publishedAt = offer.published_at || new Date().toISOString()
  const nextSendAt = computeNextSendAt(publishedAt, steps[1] ?? step0, offer)

  const { error } = await admin.from('offer_email_enrollments').upsert(
    {
      offer_id: offer.id,
      client_id: offer.client_id,
      organization_id: orgId,
      owner_id: offer.owner_id,
      current_step: 0,
      status: 'active',
      next_send_at: nextSendAt,
      last_sent_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'offer_id' }
  )

  if (error) {
    console.warn('offer_email_enrollments upsert failed:', error.message)
    return
  }

  await sendSequenceEmail(offer, step0, toEmail, offer.recipient_snapshot?.name || toEmail)

  await admin
    .from('offer_email_enrollments')
    .update({
      current_step: 1,
      last_sent_at: new Date().toISOString(),
      next_send_at: nextSendAt,
    })
    .eq('offer_id', offer.id)
}

export async function stopOfferEmailSequence(
  offerId: string,
  reason?: string
): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return
  await admin
    .from('offer_email_enrollments')
    .update({
      status: 'stopped',
      next_send_at: null,
      updated_at: new Date().toISOString(),
      metadata: reason ? { stop_reason: reason } : {},
    })
    .eq('offer_id', offerId)
    .eq('status', 'active')
}

export async function getOfferEmailSequenceStatus(offerId: string): Promise<OfferEmailEnrollment | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('offer_email_enrollments')
    .select('*')
    .eq('offer_id', offerId)
    .maybeSingle()
  return (data as OfferEmailEnrollment) || null
}

export async function toggleOfferEmailSequence(offerId: string, enabled: boolean): Promise<Offer> {
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
    .eq('id', offerId)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()
  if (fetchErr || !row) throw new Error('Offer not found')

  const meta = (row.metadata as Record<string, unknown>) || {}
  const nextMeta = { ...meta, email_sequence_enabled: enabled }

  const { data: offer, error } = await supabase
    .from('offers')
    .update({ metadata: nextMeta })
    .eq('id', offerId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  if (!enabled) {
    await stopOfferEmailSequence(offerId, 'disabled')
  }

  revalidatePath(`/offers/${offerId}`)
  return normalizeOfferRow(offer as Record<string, unknown>)
}

export async function sendOfferEmailNow(offerId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) throw new Error('No organization selected')

  const { data: row, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()
  if (error || !row) return { ok: false }

  const offer = normalizeOfferRow(row as Record<string, unknown>)
  const toEmail = offer.recipient_snapshot?.email
  if (!toEmail) return { ok: false }

  const step0 = getDefaultOfferSequenceSteps()[0]
  const sent = await sendSequenceEmail(
    offer,
    step0,
    toEmail,
    offer.recipient_snapshot?.name || toEmail
  )
  return { ok: sent }
}

export async function startOfferEmailSequenceManual(offerId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) throw new Error('No organization selected')

  const { data: row, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('owner_id', user.id)
    .eq('organization_id', organizationId)
    .single()
  if (error || !row) return { ok: false }

  await enrollOfferInEmailSequence(normalizeOfferRow(row as Record<string, unknown>))
  return { ok: true }
}

export async function processOfferEmailSequences(): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  const admin = createAdminClient()
  if (!admin) return { processed: 0, sent: 0, failed: 0 }

  const now = new Date().toISOString()
  const { data: enrollments, error } = await admin
    .from('offer_email_enrollments')
    .select('*')
    .eq('status', 'active')
    .lte('next_send_at', now)

  if (error || !enrollments?.length) {
    return { processed: 0, sent: 0, failed: 0 }
  }

  const steps = getDefaultOfferSequenceSteps()
  let sent = 0
  let failed = 0

  for (const enrollment of enrollments) {
    const { data: offerRow } = await admin
      .from('offers')
      .select('*')
      .eq('id', enrollment.offer_id)
      .single()
    if (!offerRow) continue

    const offer = normalizeOfferRow(offerRow as Record<string, unknown>)
    if (offer.status === 'paid' || offer.status === 'accepted' || !offer.is_published) {
      await admin
        .from('offer_email_enrollments')
        .update({ status: 'completed', next_send_at: null })
        .eq('id', enrollment.id)
      continue
    }

    const stepIndex = enrollment.current_step
    const step = steps[stepIndex]
    if (!step) {
      await admin
        .from('offer_email_enrollments')
        .update({ status: 'completed', next_send_at: null })
        .eq('id', enrollment.id)
      continue
    }

    if (step.skipIf?.(offer)) {
      const nextStep = steps[stepIndex + 1]
      if (!nextStep) {
        await admin
          .from('offer_email_enrollments')
          .update({ status: 'completed', next_send_at: null })
          .eq('id', enrollment.id)
      } else {
        const publishedAt = offer.published_at || enrollment.created_at
        await admin
          .from('offer_email_enrollments')
          .update({
            current_step: stepIndex + 1,
            next_send_at: computeNextSendAt(publishedAt, nextStep, offer),
          })
          .eq('id', enrollment.id)
      }
      continue
    }

    const toEmail = offer.recipient_snapshot?.email
    if (!toEmail) {
      await admin
        .from('offer_email_enrollments')
        .update({ status: 'stopped', next_send_at: null })
        .eq('id', enrollment.id)
      continue
    }

    const ok = await sendSequenceEmail(
      offer,
      step,
      toEmail,
      offer.recipient_snapshot?.name || toEmail
    )
    if (ok) {
      sent++
      const nextStep = steps[stepIndex + 1]
      const publishedAt = offer.published_at || enrollment.created_at
      if (!nextStep) {
        await admin
          .from('offer_email_enrollments')
          .update({
            status: 'completed',
            current_step: stepIndex + 1,
            last_sent_at: now,
            next_send_at: null,
          })
          .eq('id', enrollment.id)
      } else {
        await admin
          .from('offer_email_enrollments')
          .update({
            current_step: stepIndex + 1,
            last_sent_at: now,
            next_send_at: computeNextSendAt(publishedAt, nextStep, offer),
          })
          .eq('id', enrollment.id)
      }
    } else {
      failed++
    }
  }

  return { processed: enrollments.length, sent, failed }
}
