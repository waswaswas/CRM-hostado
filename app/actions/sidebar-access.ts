'use server'

import { hasFeaturePermission } from '@/app/actions/organizations'
import {
  getAssistantsAccessState,
  type AssistantsAccessState,
} from '@/app/actions/ai-assistants'

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

/**
 * One browser round-trip for sidebar access.
 * Preserves existing semantics: Promise.all of hasFeaturePermission per feature + getAssistantsAccessState.
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

  const permissionChecks = SIDEBAR_FEATURES.map(async (feature) => {
    try {
      const hasAccess = await hasFeaturePermission(organizationId, feature)
      return { feature, hasAccess }
    } catch (error) {
      console.error(`Error checking permission for ${feature}:`, error)
      return { feature, hasAccess: false }
    }
  })

  const [results, assistantsState] = await Promise.all([
    Promise.all(permissionChecks),
    getAssistantsAccessState().catch(() => fallbackAssistants),
  ])

  const permissions = {
    dashboard: false,
    clients: false,
    offers: false,
    emails: false,
    accounting: false,
    reminders: false,
    settings: false,
    users: false,
    todo: false,
  } as Record<SidebarFeature, boolean>

  for (const { feature, hasAccess } of results) {
    permissions[feature] = hasAccess
  }

  return {
    permissions,
    assistantsCanOpen: assistantsState.canUseFeature === true,
    assistantsCanManage: assistantsState.canManage === true,
  }
}
