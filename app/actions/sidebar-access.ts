'use server'

import {
  getAssistantsAccessState,
  type AssistantsAccessState,
} from '@/app/actions/ai-assistants'
import { createClient } from '@/lib/supabase/server'
import {
  resolveFeatureAccessBundle,
  type PermissionRow,
} from '@/lib/feature-permission-access'

export type SidebarFeature =
  | 'dashboard'
  | 'clients'
  | 'offers'
  | 'emails'
  | 'accounting'
  | 'reminders'
  | 'settings'
  | 'users'
  | 'todo'

const SIDEBAR_FEATURES: SidebarFeature[] = [
  'dashboard',
  'clients',
  'offers',
  'emails',
  'accounting',
  'reminders',
  'settings',
  'users',
  'todo',
]

export type SidebarAccessBundle = {
  permissions: Record<SidebarFeature, boolean>
  assistantsCanOpen: boolean
  assistantsCanManage: boolean
}

function denyAllPermissions(): Record<SidebarFeature, boolean> {
  return {
    dashboard: false,
    clients: false,
    offers: false,
    emails: false,
    accounting: false,
    reminders: false,
    settings: false,
    users: false,
    todo: false,
  }
}

/**
 * One browser round-trip for sidebar access.
 * Batches auth + membership (+ one permissions select for non-owner/admin)
 * with the same semantics as hasFeaturePermission per feature.
 * Assistants helper is unchanged (still getAssistantsAccessState in parallel).
 */
export async function getSidebarAccessBundle(
  organizationId: string
): Promise<SidebarAccessBundle> {
  const fallbackAssistants: AssistantsAccessState = {
    canUseFeature: false,
    canManage: false,
    allowedBotIds: [],
    orgId: organizationId,
  }

  const loadPermissions = async (): Promise<Record<SidebarFeature, boolean>> => {
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return denyAllPermissions()
      }

      const { data: member, error: memberError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      // Same as hasFeaturePermission: missing/inactive/non-member → deny.
      // Query failures also yield no member row → deny.
      if (!member) {
        return resolveFeatureAccessBundle(SIDEBAR_FEATURES, {
          authenticated: true,
          memberRole: null,
          membershipQueryFailed: Boolean(memberError),
        }) as Record<SidebarFeature, boolean>
      }

      // Owner/admin: all features true — skip permissions table.
      if (member.role === 'owner' || member.role === 'admin') {
        return resolveFeatureAccessBundle(SIDEBAR_FEATURES, {
          authenticated: true,
          memberRole: member.role,
        }) as Record<SidebarFeature, boolean>
      }

      const { data: permissionRows, error: permissionsError } = await supabase
        .from('organization_permissions')
        .select('feature, has_access')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)

      if (permissionsError) {
        return resolveFeatureAccessBundle(SIDEBAR_FEATURES, {
          authenticated: true,
          memberRole: member.role,
          permissionsQueryFailed: true,
        }) as Record<SidebarFeature, boolean>
      }

      return resolveFeatureAccessBundle(SIDEBAR_FEATURES, {
        authenticated: true,
        memberRole: member.role,
        permissionRows: (permissionRows ?? []) as PermissionRow[],
      }) as Record<SidebarFeature, boolean>
    } catch (error) {
      console.error('Error loading sidebar permissions:', error)
      return denyAllPermissions()
    }
  }

  const [permissions, assistantsState] = await Promise.all([
    loadPermissions(),
    getAssistantsAccessState().catch(() => fallbackAssistants),
  ])

  return {
    permissions,
    assistantsCanOpen: assistantsState.canUseFeature === true,
    assistantsCanManage: assistantsState.canManage === true,
  }
}
