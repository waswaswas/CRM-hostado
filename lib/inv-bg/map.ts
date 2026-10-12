import type { Offer, OfferLineItem, Client } from '@/types/database'
import type { ProformaFormPayload } from '@/lib/inv-bg/types'

export function buildDefaultProformaPayloadFromOffer(offer: Offer): ProformaFormPayload {
  const snap = offer.recipient_snapshot
  const bank = offer.bank_transfer_invoice
  const items: ProformaFormPayload['items'] =
    offer.line_items && offer.line_items.length > 0
      ? offer.line_items.map((i: OfferLineItem) => ({
          name: i.name,
          quantity: i.quantity || 1,
          unit_price: i.unit_price || 0,
          quantity_unit: 'бр.',
        }))
      : [
          {
            name: offer.title || 'Item',
            quantity: 1,
            unit_price: offer.amount || 0,
            quantity_unit: 'бр.',
          },
        ]

  return {
    to_name: snap?.company || snap?.name || bank?.company || '',
    to_town: snap?.city || bank?.city || '',
    to_address: snap?.address || bank?.address || '',
    to_bulstat: snap?.tax_number || bank?.tax_number || '',
    to_mol: snap?.mol || bank?.mol || '',
    to_email: snap?.email || '',
    to_country: 'България',
    is_to_person: !(snap?.tax_number || bank?.tax_number),
    payment_currency: offer.currency || 'EUR',
    notes: offer.notes || undefined,
    vat_percent: 0,
    items,
  }
}

export function buildDefaultProformaPayloadFromClient(client: Client): ProformaFormPayload {
  return {
    to_name: client.company || client.name || '',
    to_town: '',
    to_address: '',
    to_bulstat: '',
    to_mol: '',
    to_email: client.email || '',
    to_country: 'България',
    is_to_person: !client.company,
    payment_currency: 'EUR',
    notes: undefined,
    vat_percent: 0,
    items: [{ name: '', quantity: 1, unit_price: 0, quantity_unit: 'бр.' }],
  }
}
