/**
 * Server-only inv.bg APIv3 helper.
 * Auth: Authorization: Bearer ${INV_BG_API_TOKEN}
 * Docs: https://api.inv.bg/v3/docs — document type "prof" = proforma.
 */

export type InvBgProformaItem = {
  name: string
  quantity: number
  price: number
  quantity_unit?: string
  description?: string | null
}

export type InvBgProformaCreateInput = {
  to_name: string
  to_town?: string | null
  to_address?: string | null
  to_bulstat?: string | null
  to_mol?: string | null
  to_vat_number?: string | null
  to_country?: string | null
  to_email?: string | null
  is_to_person?: boolean
  payment_currency: string
  payment_method?: 'bank' | 'cash' | 'card' | 'other'
  notes?: string | null
  items: InvBgProformaItem[]
  /** VAT percent; 0 uses reason_without (default чл.113 ал.9 от ЗДДС for Hostado). */
  vat_percent?: number
  vat_reason_without?: string
}

export type InvBgProformaResult = {
  id: number
  number: string
  url: string | null
  pdf_path: string
}

function getConfig() {
  const token = process.env.INV_BG_API_TOKEN?.trim()
  const base = (process.env.INV_BG_API_BASE?.trim() || 'https://api.inv.bg/v3').replace(/\/$/, '')
  if (!token) {
    throw new Error('INV_BG_API_TOKEN is not configured in .env.local')
  }
  return { token, base }
}

async function invFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; status: number }> {
  const { token, base } = getConfig()
  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    const errObj = data as { error?: string | Record<string, unknown> } | null
    const msg =
      typeof errObj?.error === 'string'
        ? errObj.error
        : errObj?.error
          ? JSON.stringify(errObj.error)
          : text || `inv.bg HTTP ${res.status}`
    throw new Error(msg)
  }

  return { data: data as T, status: res.status }
}

export function isInvBgConfigured(): boolean {
  return Boolean(process.env.INV_BG_API_TOKEN?.trim())
}

/** Create a proforma (type=prof) on inv.bg. */
export async function createProforma(
  input: InvBgProformaCreateInput
): Promise<InvBgProformaResult> {
  if (!input.to_name?.trim()) {
    throw new Error('Buyer name / company is required')
  }
  if (!input.items?.length || input.items.every((i) => !i.name.trim())) {
    throw new Error('At least one line item is required')
  }

  const vatPercent = input.vat_percent ?? 0
  const body: Record<string, unknown> = {
    type: 'prof',
    to_name: input.to_name.trim(),
    to_country: input.to_country?.trim() || 'България',
    to_town: input.to_town?.trim() || '',
    to_address: input.to_address?.trim() || '',
    to_bulstat: input.to_bulstat?.trim() || null,
    to_mol: input.to_mol?.trim() || null,
    to_vat_number: input.to_vat_number?.trim() || null,
    is_to_person: input.is_to_person ?? !input.to_bulstat?.trim(),
    payment_currency: input.payment_currency || 'EUR',
    payment_method: input.payment_method || 'bank',
    notes: input.notes?.trim() || null,
    items: input.items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
        quantity_unit: i.quantity_unit || 'бр.',
        description: i.description ?? null,
      })),
    vat:
      vatPercent > 0
        ? { percent: vatPercent }
        : {
            percent: 0,
            reason_without: input.vat_reason_without || 'чл.113 ал.9 от ЗДДС',
          },
  }

  const { data } = await invFetch<{ id: number; number: string | number }>('/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const id = Number(data.id)
  const number = String(data.number ?? '')
  // Public app URL pattern used by inv.bg web UI for documents
  const url = id ? `https://app.inv.bg/invoice/${id}` : null

  return {
    id,
    number,
    url,
    pdf_path: `/invoices/${id}/pdf`,
  }
}
