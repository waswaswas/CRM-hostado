'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organization-context'
import { hasFeaturePermission } from '@/app/actions/organizations'

const CACHE_KEY_PREFIX = 'hostado-feature-permissions-'

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

function getCachedPermissions(orgId: string): Record<Feature, boolean> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + orgId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return { ...defaultPermissions, ...parsed } as Record<Feature, boolean>
  } catch {
    return null
  }
}

function setCachedPermissions(orgId: string, perms: Record<Feature, boolean>) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(CACHE_KEY_PREFIX + orgId, JSON.stringify(perms))
  } catch {
    // ignore
  }
}

export function useFeaturePermissions() {
  const { currentOrganization } = useOrganization()
  const [permissions, setPermissions] = useState<Record<Feature, boolean>>(defaultPermissions)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPermissions() {
      if (!currentOrganization?.id) {
        setPermissions(defaultPermissions)
        setLoading(false)
        return
      }

      const orgId = currentOrganization.id
      const cached = getCachedPermissions(orgId)
      if (cached) {
        setPermissions(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }

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
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [currentOrganization?.id])

  return { permissions, loading }
}

