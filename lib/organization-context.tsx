'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Organization } from '@/types/database'

interface OrganizationContextType {
  currentOrganization: Organization | null
  organizations: Organization[]
  isLoading: boolean
  isSwitching: boolean
  setCurrentOrganization: (org: Organization | null) => Promise<void>
  switchOrganization: (org: Organization) => Promise<void>
  refreshOrganizations: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)

  const fetchOrganizations = useCallback(async (retryCount = 0) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/organizations?t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch organizations')
      }
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        throw new Error('Unexpected response format')
      }
      const data = await response.json()
      setOrganizations(data.organizations || [])
      setCurrentOrganizationState(data.currentOrganization || null)

      if (!data.currentOrganization && data.organizations && data.organizations.length > 0) {
        const firstOrg = data.organizations[0]
        try {
          const setResponse = await fetch('/api/organizations/current', {
            method: 'POST',
            cache: 'no-store',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
            body: JSON.stringify({ organizationId: firstOrg.id }),
          })
          if (setResponse.ok) {
            const setData = await setResponse.json()
            setCurrentOrganizationState(setData.organization ?? firstOrg)
          } else {
            setCurrentOrganizationState(firstOrg)
          }
        } catch {
          setCurrentOrganizationState(firstOrg)
        }
        if (retryCount < 1) {
          setTimeout(() => fetchOrganizations(1), 100)
          return
        }
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      if (retryCount < 1) {
        setTimeout(() => fetchOrganizations(1), 500)
        return
      }
      setOrganizations([])
      setCurrentOrganizationState(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setCurrentOrganization = useCallback(async (org: Organization | null) => {
    if (!org) {
      setCurrentOrganizationState(null)
      return
    }

    try {
      const response = await fetch('/api/organizations/current', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: JSON.stringify({ organizationId: org.id }),
      })

      if (!response.ok) {
        throw new Error('Failed to set current organization')
      }

      const data = await response.json()
      setCurrentOrganizationState(data.organization)
    } catch (error) {
      console.error('Error setting current organization:', error)
    }
  }, [])

  const switchOrganization = useCallback(async (org: Organization) => {
    if (currentOrganization?.id === org.id) return
    try {
      setIsSwitching(true)
      const response = await fetch('/api/organizations/current', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: JSON.stringify({ organizationId: org.id }),
      })
      if (!response.ok) throw new Error('Failed to set current organization')
      window.location.reload()
    } catch (error) {
      console.error('Error switching organization:', error)
      setIsSwitching(false)
    }
  }, [currentOrganization?.id])

  const refreshOrganizations = useCallback(async () => {
    await fetchOrganizations()
  }, [fetchOrganizations])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const syncOrganizations = () => {
      if (!cancelled) void fetchOrganizations()
    }

    syncOrganizations()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return
      if (event === 'SIGNED_OUT' || !session?.user) {
        setOrganizations([])
        setCurrentOrganizationState(null)
        setIsLoading(false)
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        syncOrganizations()
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchOrganizations])

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        isLoading,
        isSwitching,
        setCurrentOrganization,
        switchOrganization,
        refreshOrganizations,
      }}
    >
      {children}
      {isSwitching && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Switching organization...</p>
          </div>
        </div>
      )}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return context
}
