'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationId, getCurrentUserOrgRole } from '@/app/actions/organizations'
import { revalidatePath } from 'next/cache'
import type { MagicExtractRule } from '@/lib/magic-extract-engine'
import { updateOrganization } from './organizations'

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
