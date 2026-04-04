'use client'

import { useState, useEffect, useRef } from 'react'
import { useOrganization } from '@/lib/organization-context'
import { hasFeaturePermission } from '@/app/actions/organizations'
import {
  getAssistantsAccessState,
  type AssistantsAccessState,
} from '@/app/actions/ai-assistants'

const CACHE_KEY_PREFIX = 'hostado-sidebar-access-v2-'
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

export type Feature = 'dashboard' | 'clients' | 'offers' | 'emails' | 'accounting' | 'reminders' | 'settings' | 'users' | 'todo'

const defaultPermissions: Record<Feature, boolean> = {
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

interface CachedSidebarAccess {
  v: 2
  permissions: Record<Feature, boolean>
  assistantsCanOpen: boolean
  assistantsCanManage: boolean
  timestamp: number
}

function getCached(orgId: string): CachedSidebarAccess | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + orgId)
    if (!raw) return null

    const cached = JSON.parse(raw) as Partial<CachedSidebarAccess>
    if (cached.v !== 2 || typeof cached.assistantsCanOpen !== 'boolean') {
      return null
    }

    const age = Date.now() - (cached.timestamp ?? 0)
    if (age > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY_PREFIX + orgId)
      return null
    }

    return {
      v: 2,
      permissions: { ...defaultPermissions, ...cached.permissions } as Record<Feature, boolean>,
      assistantsCanOpen: cached.assistantsCanOpen,
      assistantsCanManage: cached.assistantsCanManage === true,
      timestamp: cached.timestamp!,
    }
  } catch {
    return null
  }
}

function setCached(
  orgId: string,
  perms: Record<Feature, boolean>,
  assistantsCanOpen: boolean,
  assistantsCanManage: boolean
) {
  if (typeof window === 'undefined') return
  try {
    const cached: CachedSidebarAccess = {
      v: 2,
      permissions: perms,
      assistantsCanOpen,
      assistantsCanManage,
      timestamp: Date.now(),
    }
    localStorage.setItem(CACHE_KEY_PREFIX + orgId, JSON.stringify(cached))
  } catch {
    // ignore
  }
}

export function useFeaturePermissions() {
  const { currentOrganization } = useOrganization()
  const prevOrgIdRef = useRef<string | undefined>(undefined)

  const [permissions, setPermissions] = useState<Record<Feature, boolean>>(defaultPermissions)
  const [assistantsCanOpen, setAssistantsCanOpen] = useState(false)
  const [assistantsCanManage, setAssistantsCanManage] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPermissions() {
      if (!currentOrganization?.id) {
        setPermissions(defaultPermissions)
        setAssistantsCanOpen(false)
        setAssistantsCanManage(false)
        setLoading(false)
        prevOrgIdRef.current = undefined
        return
      }

      const orgId = currentOrganization.id
      prevOrgIdRef.current = orgId

      const cached = getCached(orgId)
      if (cached) {
        setPermissions(cached.permissions)
        setAssistantsCanOpen(cached.assistantsCanOpen)
        setAssistantsCanManage(cached.assistantsCanManage)
        setLoading(false)
      } else {
        setLoading(true)
      }

      try {
        const features: Feature[] = [
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

        const permissionChecks = features.map(async (feature) => {
          try {
            const hasAccess = await hasFeaturePermission(orgId, feature)
            return { feature, hasAccess }
          } catch (error) {
            console.error(`Error checking permission for ${feature}:`, error)
            return { feature, hasAccess: false }
          }
        })

        const fallbackAssistants: AssistantsAccessState = {
          canUseFeature: false,
          canManage: false,
          allowedBotIds: [],
          orgId,
        }

        const [results, assistantsState] = await Promise.all([
          Promise.all(permissionChecks),
          getAssistantsAccessState().catch(() => fallbackAssistants),
        ])

        const permMap: Partial<Record<Feature, boolean>> = {}
        results.forEach(({ feature, hasAccess }) => {
          permMap[feature] = hasAccess
        })
        const next = permMap as Record<Feature, boolean>
        const open = assistantsState.canUseFeature === true
        const manage = assistantsState.canManage === true

        setPermissions(next)
        setAssistantsCanOpen(open)
        setAssistantsCanManage(manage)
        setCached(orgId, next, open, manage)
      } catch (error) {
        console.error('Error loading permissions:', error)
        if (!cached) {
          setPermissions(defaultPermissions)
          setAssistantsCanOpen(false)
          setAssistantsCanManage(false)
        }
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [currentOrganization?.id])

  return { permissions, loading, assistantsCanOpen, assistantsCanManage }
}
