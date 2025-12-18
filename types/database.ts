// Presales statuses (Note: "new" is now a separate tag, not a status)
export type PresalesStatus = 'contacted' | 'attention_needed' | 'follow_up_required' | 'waits_for_offer' | 'on_hold' | 'abandoned'
// Customer statuses
export type CustomerStatus = 'active' | 'inactive'
// Combined type
export type ClientStatus = PresalesStatus | CustomerStatus
export type ClientType = 'presales' | 'customer'
export type InteractionType = 'call' | 'email' | 'meeting' | 'other'
export type InteractionDirection = 'inbound' | 'outbound'

export interface Client {
  id: string
  created_at: string
  owner_id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  status: ClientStatus
  client_type: ClientType | null
  source: string | null
  notes_summary: string | null
}

export interface Interaction {
  id: string
  created_at: string
  client_id: string
  type: InteractionType
  direction: InteractionDirection | null
  date: string
  duration_minutes: number | null
  subject: string
  notes: string
  email_id: string | null
}

export interface Reminder {
  id: string
  created_at: string
  client_id: string
  due_at: string
  title: string
  description: string | null
  done: boolean
}

export interface ClientNote {
  id: string
  created_at: string
  client_id: string
  content: string
  pinned: boolean
}

export interface ClientWithRelations extends Client {
  interactions?: Interaction[]
  reminders?: Reminder[]
  notes?: ClientNote[]
}

// Offers
export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'paid' | 'pending_payment'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
export type PaymentProvider = 'stripe' | 'epay' | 'paypal' | 'manual'

export interface Offer {
  id: string
  created_at: string
  updated_at: string
  owner_id: string
  client_id: string
  title: string
  description: string | null
  amount: number
  currency: string
  status: OfferStatus
  valid_until: string | null
  notes: string | null
  document_url: string | null
  payment_enabled: boolean
  payment_link: string | null
  payment_token: string | null
  payment_provider: PaymentProvider | null
  payment_status: PaymentStatus | null
  payment_id: string | null
  paid_at: string | null
  payment_method: string | null
}

export interface Payment {
  id: string
  created_at: string
  offer_id: string
  amount: number
  currency: string
  status: PaymentStatus
  payment_provider: PaymentProvider
  payment_id: string | null
  payment_method: string | null
  client_email: string | null
  client_name: string | null
  metadata: Record<string, any> | null
  paid_at: string | null
}



