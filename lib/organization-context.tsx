'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations')
      if (!response.ok) {
        throw new Error('Failed to fetch organizations')
      }
      const data = await response.json()
      setOrganizations(data.organizations || [])
      setCurrentOrganizationState(data.currentOrganization || null)
      
      // Auto-select first organization if none selected and organizations exist
      if (!data.currentOrganization && data.organizations && data.organizations.length > 0) {
        await setCurrentOrganization(data.organizations[0])
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      setOrganizations([])
      setCurrentOrganizationState(null)
    } finally {
      setIsLoading(false)
    }
  }

  const setCurrentOrganization = async (org: Organization | null) => {
    if (!org) {
      setCurrentOrganizationState(null)
      return
    }

    try {
      const response = await fetch('/api/organizations/current', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId: org.id }),
      })

      if (!response.ok) {
        throw new Error('Failed to set current organization')
      }

      const data = await response.json()
      setCurrentOrganizationState(data.organization)
      router.refresh()
    } catch (error) {
      console.error('Error setting current organization:', error)
    }
  }

  const refreshOrganizations = async () => {
    await fetchOrganizations()
  }

  useEffect(() => {
    fetchOrganizations()
  }, [])

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

