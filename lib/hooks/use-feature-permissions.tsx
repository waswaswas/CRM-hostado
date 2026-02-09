'use client'

import { useState, useEffect, useRef } from 'react'
import { useOrganization } from '@/lib/organization-context'
import { hasFeaturePermission } from '@/app/actions/organizations'

const CACHE_KEY_PREFIX = 'hostado-feature-permissions-'
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

interface CachedPermissions {
  permissions: Record<Feature, boolean>
  timestamp: number
}

function getCachedPermissions(orgId: string): Record<Feature, boolean> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + orgId)
    if (!raw) return null
    
    const cached: CachedPermissions = JSON.parse(raw)
    
    // Check if cache is expired
    const age = Date.now() - cached.timestamp
    if (age > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY_PREFIX + orgId)
      return null
    }
    
    return { ...defaultPermissions, ...cached.permissions } as Record<Feature, boolean>
  } catch {
    return null
  }
}

function setCachedPermissions(orgId: string, perms: Record<Feature, boolean>) {
  if (typeof window === 'undefined') return
  try {
    const cached: CachedPermissions = {
      permissions: perms,
      timestamp: Date.now()
    }
    localStorage.setItem(CACHE_KEY_PREFIX + orgId, JSON.stringify(cached))
  } catch {
    // ignore
  }
}

export function useFeaturePermissions() {
  const { currentOrganization } = useOrganization()
  const prevOrgIdRef = useRef<string | undefined>()
  
  // Initialize permissions from cache synchronously to prevent flash
  const [permissions, setPermissions] = useState<Record<Feature, boolean>>(() => {
    if (typeof window === 'undefined') return defaultPermissions
    // Try to get cached permissions for current org if available
    // Note: currentOrganization might not be available on first render, that's OK
    return defaultPermissions
  })
  
  // Initialize loading state based on cache availability
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    // We'll check cache availability in useEffect
    return true
  })

  useEffect(() => {
    async function loadPermissions() {
      if (!currentOrganization?.id) {
        setPermissions(defaultPermissions)
        setLoading(false)
        prevOrgIdRef.current = undefined
        return
      }

      const orgId = currentOrganization.id
      
      // Clear cache if organization changed
      if (prevOrgIdRef.current && prevOrgIdRef.current !== orgId) {
        // Organization changed - cache will be loaded for new org below
      }
      prevOrgIdRef.current = orgId

      // Try to load from cache first (synchronous check)
      const cached = getCachedPermissions(orgId)
      if (cached) {
        // Use cached permissions immediately to prevent flash
        setPermissions(cached)
        setLoading(false)
      } else {
        // No cache - we need to fetch, but start with restrictive default
        // Permissions already initialized to defaultPermissions (all false)
        setLoading(true)
      }

      // Always fetch fresh permissions (cache might be stale)
      // This happens in the background and updates permissions when ready
      try {
        const features: Feature[] = ['dashboard', 'clients', 'offers', 'emails', 'accounting', 'reminders', 'settings', 'users', 'todo']
        const permMap: Partial<Record<Feature, boolean>> = {}

        const permissionChecks = features.map(async (feature) => {
          try {
            const hasAccess = await hasFeaturePermission(orgId, feature)
            return { feature, hasAccess }
          } catch (error) {
            console.error(`Error checking permission for ${feature}:`, error)
            return { feature, hasAccess: false }
          }
        })

        const results = await Promise.all(permissionChecks)
        results.forEach(({ feature, hasAccess }) => {
          permMap[feature] = hasAccess
        })

        const next = permMap as Record<Feature, boolean>
        setPermissions(next)
        setCachedPermissions(orgId, next)
      } catch (error) {
        console.error('Error loading permissions:', error)
        // On error, keep cached permissions if available, otherwise use restrictive default
        if (!cached) {
          setPermissions(defaultPermissions)
        }
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [currentOrganization?.id])

  return { permissions, loading }
}

