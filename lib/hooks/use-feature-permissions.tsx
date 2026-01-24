'use client'

import { useState, useEffect } from 'react'
import { useOrganization } from '@/lib/organization-context'
import { hasFeaturePermission } from '@/app/actions/organizations'

export type Feature = 'dashboard' | 'clients' | 'offers' | 'emails' | 'accounting' | 'reminders' | 'settings' | 'users' | 'todo'

export function useFeaturePermissions() {
  const { currentOrganization } = useOrganization()
  const [permissions, setPermissions] = useState<Record<Feature, boolean>>({
    dashboard: true, // Always true
    clients: false,
    offers: false,
    emails: false,
    accounting: false,
    reminders: false,
    settings: false,
    users: false,
    todo: false,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPermissions() {
      if (!currentOrganization?.id) {
        // If no organization, only dashboard is accessible
        setPermissions({
          dashboard: true,
          clients: false,
          offers: false,
          emails: false,
          accounting: false,
          reminders: false,
          settings: false,
          users: false,
          todo: false,
        })
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const features: Feature[] = ['dashboard', 'clients', 'offers', 'emails', 'accounting', 'reminders', 'settings', 'users', 'todo']
        const permMap: Partial<Record<Feature, boolean>> = {
          dashboard: true, // Always accessible
        }

        // Check permissions for each feature
        const permissionChecks = features.map(async (feature) => {
          try {
            const hasAccess = await hasFeaturePermission(currentOrganization.id, feature)
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

        setPermissions(permMap as Record<Feature, boolean>)
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

