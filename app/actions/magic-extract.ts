'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationId, getCurrentUserOrgRole } from '@/app/actions/organizations'
import { revalidatePath } from 'next/cache'
import type { MagicExtractRule } from '@/lib/magic-extract-engine'
import { updateOrganization } from './organizations'

/** Default rule for "Ново запитване от контактната форма" (contact form / initial inquiry). */
const INITIAL_INQUIRY_RULE: MagicExtractRule = {
  id: 'initial-inquiry-contact-form',
  name: 'Initial inquiry (contact form)',
  subject_match: 'Ново запитване от контактната форма',
  subject_match_type: 'contains',
  variable_mapping: [
    { key: 'name', extraction_type: 'label', pattern: 'Вашето име', target_field: 'name' },
    { key: 'email', extraction_type: 'label', pattern: 'Email', target_field: 'email' },
    { key: 'phone', extraction_type: 'label', pattern: 'Телефон', target_field: 'phone' },
    { key: 'message', extraction_type: 'regex', pattern: '::\\s*([\\s\\S]+)', target_field: 'message' },
  ],
  create_interaction: true,
  create_notification: true,
  is_active: true,
  sort_order: 0,
}

const HOSTADO_SLUG = 'hostado'
const INITIAL_INQUIRY_SUBJECT = 'Ново запитване от контактната форма'

/** Get Magic extract rules for the current organization. Any org member can read. */
export async function getMagicExtractRules(): Promise<MagicExtractRule[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) return []

  const { data: org, error } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .single()

  if (error || !org) return []
  const rules = (org.settings as Record<string, unknown>)?.magic_extract_rules
  if (!Array.isArray(rules)) return []
  return rules as MagicExtractRule[]
}

/**
 * Get Magic extract rules for a given organization (used by email processing).
 * Caller must be authenticated; RLS ensures org access.
 */
export async function getMagicExtractRulesForOrg(organizationId: string): Promise<MagicExtractRule[]> {
  if (!organizationId) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: org, error } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .single()

  if (error || !org) return []
  const rules = (org.settings as Record<string, unknown>)?.magic_extract_rules
  if (!Array.isArray(rules)) return []
  return (rules as MagicExtractRule[]).filter((r) => r.is_active).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

/** Save Magic extract rules. Only organization owner can update. */
export async function saveMagicExtractRules(rules: MagicExtractRule[]): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const role = await getCurrentUserOrgRole()
  if (role !== 'owner') throw new Error('Only the organization owner can manage Magic extract rules')

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) throw new Error('No organization selected')

  const { data: org, error: fetchError } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .single()

  if (fetchError || !org) throw new Error('Organization not found')

  const updatedSettings = {
    ...(typeof org.settings === 'object' && org.settings !== null ? (org.settings as Record<string, unknown>) : {}),
    magic_extract_rules: rules,
  }

  await updateOrganization(organizationId, { settings: updatedSettings })
  revalidatePath('/emails')
  revalidatePath('/emails/magic-extract')
}

/**
 * Seed the initial inquiry (contact form) rule for the Hostado org if missing.
 * Call from the Magic extract page when current org is Hostado so owners can see and manage it.
 */
export async function seedInitialInquiryRuleForHostado(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const role = await getCurrentUserOrgRole()
  if (role !== 'owner') return

  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) return

  const { data: org, error } = await supabase
    .from('organizations')
    .select('slug, settings')
    .eq('id', organizationId)
    .single()

  if (error || !org || (org.slug || '').toLowerCase() !== HOSTADO_SLUG) return

  const settings = (typeof org.settings === 'object' && org.settings !== null
    ? org.settings
    : {}) as Record<string, unknown>
  const rules = (settings.magic_extract_rules as MagicExtractRule[] | undefined) ?? []

  const hasInitialInquiry = rules.some(
    (r) =>
      r.subject_match &&
      (r.subject_match === INITIAL_INQUIRY_SUBJECT || r.subject_match.includes('Ново запитване'))
  )
  if (hasInitialInquiry) return

  const newRules = [{ ...INITIAL_INQUIRY_RULE, id: `${INITIAL_INQUIRY_RULE.id}-${organizationId.slice(0, 8)}` }, ...rules]
  const updatedSettings = { ...settings, magic_extract_rules: newRules }
  await updateOrganization(organizationId, { settings: updatedSettings })
  revalidatePath('/emails')
  revalidatePath('/emails/magic-extract')
}
