export type ClientStatus = 'new' | 'contacted' | 'in_progress' | 'won' | 'lost' | 'to_be_contacted' | 'waiting_for_response' | 'waiting_for_offer' | 'abandoned'
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
