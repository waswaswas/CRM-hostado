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
  is_deleted?: boolean
  deleted_at?: string | null
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

/** Line item for offer document (Bulgarian: Артикул, Количество, Цена без ДДС, Стойност) */
export interface OfferLineItem {
  name: string
  quantity: number
  unit_price: number
  /** Optional catalog/sku number */
  catalog_no?: string
}

/** Recipient snapshot for offer document (EIK/Булстат, МОЛ, Град, Адрес, Получател, VAT, client type) */
export interface OfferRecipientSnapshot {
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  tax_number: string | null
  mol: string | null
  client_type: string | null
}

/** Stored in offers.metadata JSONB (minimal DB: one column). Run migration_offers_metadata.sql when Supabase is available. */
export interface OfferMetadata {
  is_public?: boolean
  is_published?: boolean
  published_at?: string
  unpublish_after_days?: number
  is_archived?: boolean
  opened_at?: string | null
  opened_history?: string[]
  line_items?: OfferLineItem[]
  recipient_snapshot?: OfferRecipientSnapshot | null
  correction_requests?: { message: string; email: string; at: string }[]
}

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
  /** From metadata JSONB when present */
  metadata?: OfferMetadata | null
  is_public?: boolean
  is_published?: boolean
  published_at?: string | null
  unpublish_after_days?: number | null
  is_archived?: boolean
  opened_at?: string | null
  opened_history?: string[]
  line_items?: OfferLineItem[]
  recipient_snapshot?: OfferRecipientSnapshot | null
  correction_requests?: { message: string; email: string; at: string }[]
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

// Accounting
export type AccountType = 'bank' | 'cash' | 'credit_card' | 'other'
export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Account {
  id: string
  created_at: string
  updated_at: string
  owner_id: string
  name: string
  account_number: string | null
  bank_name: string | null
  bank_phone: string | null
  type: AccountType
  currency: string
  opening_balance: number
  current_balance: number
  is_locked: boolean | null
  notes: string | null
}

export interface TransactionCategory {
  id: string
  created_at: string
  owner_id: string
  name: string
  type: 'income' | 'expense'
  color: string | null
  parent_id: string | null
}

export interface Transaction {
  id: string
  created_at: string
  updated_at: string
  owner_id: string
  account_id: string
  type: TransactionType
  number: string
  date: string
  amount: number
  currency: string
  category: string | null
  payment_method: string
  description: string | null
  reference: string | null
  contact_id: string | null
  tax_id: string | null
  attachment_url: string | null
  created_by: string | null
  transfer_to_account_id: string | null
  transfer_transaction_id: string | null
}

export interface TransactionWithRelations extends Transaction {
  account?: Account
  contact?: Client
  accounting_customer?: AccountingCustomer
  transfer_to_account?: { id: string; name: string }
  transfer_from_account?: { id: string; name: string }
  transfer_transaction?: { account_id: string; account?: { id: string; name: string } }
}

// Accounting Customers (separate from CRM clients)
export interface AccountingCustomer {
  id: string
  created_at: string
  updated_at: string
  owner_id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  tax_number: string | null
  website: string | null
  notes: string | null
  linked_client_id: string | null
}

export interface AccountingCustomerWithRelations extends AccountingCustomer {
  linked_client?: Client
}

export interface Notification {
  id: string
  created_at: string
  owner_id: string
  type: 'email' | 'reminder' | 'tag_removed' | 'other'
  title: string
  message: string | null
  is_read: boolean
  read_at: string | null
  related_id: string | null
  related_type: string | null
  metadata: Record<string, any>
}

// Organizations
export interface Organization {
  id: string
  created_at: string
  updated_at: string
  name: string
  slug: string
  owner_id: string
  settings: Record<string, any>
  is_active: boolean
}

export interface OrganizationMember {
  id: string
  created_at: string
  updated_at: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'moderator' | 'viewer'
  invited_by: string | null
  joined_at: string | null
  is_active: boolean
  user_email?: string
  user_name?: string
}

export interface OrganizationPermission {
  id: string
  created_at: string
  updated_at: string
  organization_id: string
  user_id: string
  feature: 'email' | 'accounting' | 'users' | 'reminders' | 'offers' | 'clients' | 'settings' | 'dashboard' | 'todo'
  has_access: boolean
}

export interface OrganizationInvitation {
  id: string
  created_at: string
  updated_at: string
  organization_id: string
  email: string
  invited_by: string
  role: 'owner' | 'admin' | 'moderator' | 'viewer'
  token: string
  expires_at: string
  accepted_at: string | null
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  feature_permissions: Record<string, boolean>
  organization_name?: string
  inviter_name?: string
}



