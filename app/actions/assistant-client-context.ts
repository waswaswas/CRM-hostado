'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationId } from '@/app/actions/organizations'
import { latinToBulgarianCyrillicApprox } from '@/lib/ai-assistants/latin-to-bulgarian-cyrillic'
import { format } from 'date-fns'

const MAX_CLIENTS = 5
const MAX_INTERACTIONS = 35
const MAX_NOTES = 20
const MAX_FIELD = 1200

function clip(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/**
 * Loads client profile, timeline (interactions), and notes for assistant system context.
 */
export async function buildAssistantReferencedClientsContext(
  clientIds: string[]
): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return ''
  }

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId || clientIds.length === 0) {
    return ''
  }

  const unique = [...new Set(clientIds)].filter(Boolean).slice(0, MAX_CLIENTS)
  if (unique.length === 0) return ''

  const sections: string[] = []

  for (const clientId of unique) {
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, company, email, phone, status, source, notes_summary, client_type')
      .eq('id', clientId)
      .eq('organization_id', organizationId)
      .eq('is_deleted', false)
      .maybeSingle()

    if (clientErr || !client) {
      continue
    }

    const nameCyr = latinToBulgarianCyrillicApprox(client.name || '')
    const companyCyr = client.company ? latinToBulgarianCyrillicApprox(client.company) : ''

    const [{ data: interactions }, { data: notesRows }] = await Promise.all([
      supabase
        .from('interactions')
        .select('type, direction, date, duration_minutes, subject, notes, email_id')
        .eq('client_id', clientId)
        .eq('organization_id', organizationId)
        .order('date', { ascending: false })
        .limit(MAX_INTERACTIONS),
      supabase
        .from('client_notes')
        .select('content, pinned, created_at')
        .eq('client_id', clientId)
        .eq('organization_id', organizationId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(MAX_NOTES),
    ])

    const lines: string[] = []
    lines.push(`### Client: ${client.name}`)
    lines.push(`- CRM name (Latin as stored): ${client.name}`)
    if (nameCyr && nameCyr !== client.name) {
      lines.push(`- Name approximate Cyrillic (for Bulgarian correspondence): ${nameCyr}`)
    }
    if (client.company) {
      lines.push(`- Company (stored): ${client.company}`)
      if (companyCyr && companyCyr !== client.company) {
        lines.push(`- Company approximate Cyrillic: ${companyCyr}`)
      }
    }
    if (client.email) lines.push(`- Email: ${client.email}`)
    if (client.phone) lines.push(`- Phone: ${client.phone}`)
    if (client.status) lines.push(`- Status: ${client.status}`)
    if (client.client_type) lines.push(`- Type: ${client.client_type}`)
    if (client.source) lines.push(`- Source: ${client.source}`)
    if (client.notes_summary) {
      lines.push(`- Summary: ${clip(client.notes_summary, MAX_FIELD)}`)
    }

    lines.push('')
    lines.push('#### Timeline (interactions, newest first)')
    const interList = interactions ?? []
    if (interList.length === 0) {
      lines.push('(No interactions recorded.)')
    } else {
      for (const row of interList) {
        const when = row.date
          ? format(new Date(row.date), 'yyyy-MM-dd HH:mm')
          : '—'
        const dir = row.direction ? `, ${row.direction}` : ''
        const dur =
          row.duration_minutes != null ? `, ${row.duration_minutes} min` : ''
        lines.push(
          `- [${when}] ${row.type}${dir}${dur}: ${clip(row.subject || '—', 400)}`
        )
        if (row.notes && String(row.notes).trim()) {
          lines.push(`  Notes: ${clip(String(row.notes), MAX_FIELD)}`)
        }
        if (row.email_id) {
          lines.push(`  Linked email id: ${row.email_id}`)
        }
      }
    }

    lines.push('')
    lines.push('#### Notes')
    const notes = notesRows ?? []
    if (notes.length === 0) {
      lines.push('(No notes.)')
    } else {
      for (const n of notes) {
        const when = n.created_at
          ? format(new Date(n.created_at), 'yyyy-MM-dd HH:mm')
          : '—'
        const pin = n.pinned ? ' [pinned]' : ''
        lines.push(`- [${when}]${pin} ${clip(n.content || '', MAX_FIELD)}`)
      }
    }

    sections.push(lines.join('\n'))
  }

  if (sections.length === 0) {
    return ''
  }

  return [
    'The user referenced the following CRM client(s) with @ in their message. Use this data when drafting (e.g. emails in Bulgarian Cyrillic when appropriate). Do not invent facts beyond this snapshot.',
    '',
    sections.join('\n\n---\n\n'),
  ].join('\n')
}
