import type { Offer, OfferMetadata } from '@/types/database'

/** Flatten metadata onto offer for app use. Handles missing metadata column. */
export function normalizeOfferRow(row: Record<string, unknown> | null | undefined): Offer {
  if (!row || typeof row !== 'object') {
    throw new Error('Invalid offer row')
  }
  const meta = (row.metadata as OfferMetadata | null) || {}
  const openedHistory = Array.isArray(meta.opened_history)
    ? meta.opened_history
    : meta.opened_at
      ? [meta.opened_at]
      : []
  const openedAt = openedHistory.length > 0 ? openedHistory[openedHistory.length - 1] : null
  return {
    ...row,
    metadata: meta,
    is_public: meta.is_public ?? false,
    is_published: meta.is_published ?? false,
    published_at: meta.published_at ?? null,
    unpublish_after_days: meta.unpublish_after_days ?? null,
    is_archived: meta.is_archived ?? false,
    opened_at: openedAt,
    opened_history: openedHistory,
    line_items: meta.line_items ?? [],
    recipient_snapshot: meta.recipient_snapshot ?? null,
    correction_requests: meta.correction_requests ?? [],
    email_sequence_enabled: meta.email_sequence_enabled ?? true,
    bank_transfer_intent_at: meta.bank_transfer_intent_at ?? null,
  } as Offer
}
