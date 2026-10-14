'use client'

import { useState, useEffect, useRef } from 'react'
import { useOrganization } from '@/lib/organization-context'
import {
  getSidebarAccessBundle,
  type SidebarFeature,
} from '@/app/actions/sidebar-access'

const CACHE_KEY_PREFIX = 'hostado-sidebar-access-v2-'
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

export type Feature = SidebarFeature

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
  const requestIdRef = useRef(0)

  const [permissions, setPermissions] = useState<Record<Feature, boolean>>(defaultPermissions)
  const [assistantsCanOpen, setAssistantsCanOpen] = useState(false)
  const [assistantsCanManage, setAssistantsCanManage] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const requestId = ++requestIdRef.current

    async function loadPermissions() {
      if (!currentOrganization?.id) {
        if (cancelled || requestId !== requestIdRef.current) return
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
        if (cancelled || requestId !== requestIdRef.current) return
        setPermissions(cached.permissions)
        setAssistantsCanOpen(cached.assistantsCanOpen)
        setAssistantsCanManage(cached.assistantsCanManage)
        setLoading(false)
      } else {
        if (cancelled || requestId !== requestIdRef.current) return
        setLoading(true)
      }

      try {
        const bundle = await getSidebarAccessBundle(orgId)
        if (cancelled || requestId !== requestIdRef.current) return
        if (prevOrgIdRef.current !== orgId) return

        setPermissions(bundle.permissions)
        setAssistantsCanOpen(bundle.assistantsCanOpen)
        setAssistantsCanManage(bundle.assistantsCanManage)
        setCached(
          orgId,
          bundle.permissions,
          bundle.assistantsCanOpen,
          bundle.assistantsCanManage
        )
      } catch (error) {
        console.error('Error loading permissions:', error)
        if (cancelled || requestId !== requestIdRef.current) return
        if (!cached) {
          setPermissions(defaultPermissions)
          setAssistantsCanOpen(false)
          setAssistantsCanManage(false)
        }
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    }

    void loadPermissions()

    return () => {
      cancelled = true
    }
  }, [currentOrganization?.id])

  return { permissions, loading, assistantsCanOpen, assistantsCanManage }
}
