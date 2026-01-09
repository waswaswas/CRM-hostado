'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Organization } from '@/types/database'

interface OrganizationContextType {
  currentOrganization: Organization | null
  organizations: Organization[]
  isLoading: boolean
  setCurrentOrganization: (org: Organization | null) => Promise<void>
  refreshOrganizations: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

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
      // Refresh the page to ensure all server components get updated data
      router.refresh()
    } catch (error) {
      console.error('Error setting current organization:', error)
    }
  }, [router])

  const fetchOrganizations = useCallback(async (retryCount = 0) => {
    try {
      setIsLoading(true)
      // Use cache: 'no-store' to prevent browser caching
      // Add timestamp to prevent any caching
      const response = await fetch(`/api/organizations?t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch organizations')
      }
      const data = await response.json()
      setOrganizations(data.organizations || [])
      setCurrentOrganizationState(data.currentOrganization || null)
      
      // Auto-select first organization if none selected and organizations exist
      if (!data.currentOrganization && data.organizations && data.organizations.length > 0) {
        await setCurrentOrganization(data.organizations[0])
        // After setting, fetch again to ensure we have the updated organization
        if (retryCount < 1) {
          setTimeout(() => fetchOrganizations(1), 100)
          return
        }
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      // Retry once after a short delay if first attempt fails
      if (retryCount < 1) {
        setTimeout(() => fetchOrganizations(1), 500)
        return
      }
      setOrganizations([])
      setCurrentOrganizationState(null)
    } finally {
      setIsLoading(false)
    }
  }, [setCurrentOrganization])

  const refreshOrganizations = useCallback(async () => {
    await fetchOrganizations()
  }, [fetchOrganizations])

  useEffect(() => {
    // Fetch immediately
    fetchOrganizations()
    // Also set up a listener for focus events to refresh when user comes back to tab
    const handleFocus = () => {
      fetchOrganizations()
    }
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchOrganizations])

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        isLoading,
        setCurrentOrganization,
        refreshOrganizations,
      }}
    >
      {children}
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

