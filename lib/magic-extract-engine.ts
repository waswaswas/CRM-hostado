/**
 * Magic extract: configurable email subject matching and body extraction.
 * No DB schema changes - rules are stored in organizations.settings.magic_extract_rules (JSON).
 */

export type SubjectMatchType = 'contains' | 'equals' | 'regex'

export interface MagicExtractVariableMapping {
  key: string
  extraction_type: 'regex' | 'label'
  pattern: string
  target_field: string
}

export interface MagicExtractRule {
  id: string
  name: string
  subject_match: string
  subject_match_type: SubjectMatchType
  variable_mapping: MagicExtractVariableMapping[]
  create_interaction: boolean
  create_notification: boolean
  is_active: boolean
  sort_order: number
}

/** Normalize email body to plain text for extraction (HTML stripped, whitespace normalized). */
export function normalizeBody(body: string): string {
  if (!body || typeof body !== 'string') return ''
  let text = body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
  return text
}

/** Returns true if the email subject matches the rule. */
export function subjectMatches(rule: MagicExtractRule, subject: string): boolean {
  if (!rule.is_active || !rule.subject_match) return false
  const sub = (subject || '').trim()
  const match = rule.subject_match.trim()
  switch (rule.subject_match_type) {
    case 'equals':
      return sub === match
    case 'regex': {
      try {
        const re = new RegExp(match)
        return re.test(sub)
      } catch {
        return false
      }
    }
    case 'contains':
    default:
      return sub.includes(match)
  }
}

/**
 * Extract key-value map from email body using the rule's variable_mapping.
 * Returns null if required client identifier (email) is missing.
 */
export function extractWithRule(body: string, rule: MagicExtractRule): Record<string, string> | null {
  const text = normalizeBody(body)
  const result: Record<string, string> = {}
  const mapping = rule.variable_mapping || []

  for (const m of mapping) {
    if (!m.pattern || !m.target_field) continue
    let value = ''
    if (m.extraction_type === 'label') {
      const escaped = m.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`${escaped}\\s*:?\\s*([^\\n]+)`, 'i')
      const match = text.match(re)
      if (match && match[1]) value = match[1].trim()
    } else {
      try {
        const re = new RegExp(m.pattern, 'i')
        const match = text.match(re)
        if (match && match[1]) value = match[1].trim()
      } catch {
        // invalid regex
      }
    }
    if (value) result[m.target_field] = value
  }

  // Require at least email for client lookup/creation
  const email = result['email'] || result['clients.email'] || ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

  return result
}

/** Map extracted record to formData-like shape for processMagicExtractInquiry. */
export function extractedToFormData(extracted: Record<string, string>): {
  name: string
  email: string
  phone?: string
  message: string
  company?: string
  notes_summary?: string
} {
  const name =
    extracted['name'] ?? extracted['clients.name'] ?? extracted['firstName'] ?? ''
  const email =
    extracted['email'] ?? extracted['clients.email'] ?? ''
  const phone =
    extracted['phone'] ?? extracted['clients.phone'] ?? undefined
  const message =
    extracted['message'] ?? extracted['body'] ?? ''
  const company =
    extracted['company'] ?? extracted['clients.company'] ?? undefined
  const notes_summary =
    extracted['notes_summary'] ?? extracted['clients.notes_summary'] ?? undefined

  return {
    name: name || email.split('@')[0] || 'Unknown',
    email,
    phone: phone || undefined,
    message: message || '',
    company,
    notes_summary,
  }
}
