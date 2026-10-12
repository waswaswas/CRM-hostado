export type ProformaFormPayload = {
  to_name: string
  to_town?: string
  to_address?: string
  to_bulstat?: string
  to_mol?: string
  to_vat_number?: string
  to_country?: string
  to_email?: string
  is_to_person?: boolean
  payment_currency: string
  notes?: string
  vat_percent?: number
  items: { name: string; quantity: number; unit_price: number; quantity_unit?: string }[]
  /** When creating from client: attach sync to this offer if provided */
  attach_offer_id?: string | null
}
