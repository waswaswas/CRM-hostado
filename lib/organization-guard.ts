import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Checks if the current user has at least one active organization membership
 * @returns true if user has organizations, false otherwise
 */
export async function userHasOrganizations(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { data: members } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)

  return members && members.length > 0
}

/**
 * Redirects to /join-organization if user has no organizations
 * Use this in page components that require organization membership
 */
export async function requireOrganization() {
  const hasOrgs = await userHasOrganizations()
  if (!hasOrgs) {
    redirect('/join-organization')
  }
}
