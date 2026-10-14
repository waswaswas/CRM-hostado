'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
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

  // Dedup concurrent fetches (mount + INITIAL_SESSION) and ignore stale completions.
  const inFlightRef = useRef<Promise<void> | null>(null)
  const fetchGenerationRef = useRef(0)
  /** Separate counter so org selection races don't get clobbered by a list refetch. */
  const selectionGenerationRef = useRef(0)
  const retryTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const mountedRef = useRef(true)

  const clearPendingRetries = useCallback(() => {
    for (const t of retryTimeoutsRef.current) clearTimeout(t)
    retryTimeoutsRef.current = []
  }, [])

  const invalidateInFlight = useCallback(() => {
    fetchGenerationRef.current += 1
    selectionGenerationRef.current += 1
    inFlightRef.current = null
    clearPendingRetries()
    // Never leave the UI spinning after cancellation / sign-out / unmount.
    setIsLoading(false)
  }, [clearPendingRetries])

  const scheduleRetry = useCallback(
    (fn: () => void, delayMs: number, generation: number) => {
      const timeoutId = setTimeout(() => {
        retryTimeoutsRef.current = retryTimeoutsRef.current.filter((id) => id !== timeoutId)
        if (!mountedRef.current) return
        if (generation !== fetchGenerationRef.current) return
        fn()
      }, delayMs)
      retryTimeoutsRef.current.push(timeoutId)
    },
    []
  )

  const fetchOrganizations = useCallback(
    async (retryCount = 0) => {
      if (retryCount === 0 && inFlightRef.current) {
        return inFlightRef.current
      }

      const generation = ++fetchGenerationRef.current
      // Avoid TDZ: hold promise on an object so finally can compare safely even on sync early-return.
      const slot: { promise: Promise<void> | null } = { promise: null }

      slot.promise = (async () => {
        try {
          if (!mountedRef.current || generation !== fetchGenerationRef.current) return
          setIsLoading(true)

          const response = await fetch(`/api/organizations?t=${Date.now()}`, {
            cache: 'no-store',
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
          })
          if (!mountedRef.current || generation !== fetchGenerationRef.current) return

          if (!response.ok) {
            throw new Error('Failed to fetch organizations')
          }
          const contentType = response.headers.get('content-type') ?? ''
          if (!contentType.includes('application/json')) {
            throw new Error('Unexpected response format')
          }

          const data = await response.json()
          if (!mountedRef.current || generation !== fetchGenerationRef.current) return

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
              if (!mountedRef.current || generation !== fetchGenerationRef.current) return

              if (setResponse.ok) {
                const setData = await setResponse.json()
                if (!mountedRef.current || generation !== fetchGenerationRef.current) return
                setCurrentOrganizationState(setData.organization ?? firstOrg)
              } else {
                setCurrentOrganizationState(firstOrg)
              }
            } catch {
              if (!mountedRef.current || generation !== fetchGenerationRef.current) return
              setCurrentOrganizationState(firstOrg)
            }
            if (retryCount < 1) {
              scheduleRetry(() => {
                void fetchOrganizations(1)
              }, 100, generation)
              return
            }
          }
        } catch (error) {
          console.error('Error fetching organizations:', error)
          if (!mountedRef.current || generation !== fetchGenerationRef.current) return
          if (retryCount < 1) {
            scheduleRetry(() => {
              void fetchOrganizations(1)
            }, 500, generation)
            return
          }
          setOrganizations([])
          setCurrentOrganizationState(null)
        } finally {
          if (mountedRef.current && generation === fetchGenerationRef.current) {
            setIsLoading(false)
          }
          if (retryCount === 0 && inFlightRef.current === slot.promise) {
            inFlightRef.current = null
          }
        }
      })()

      if (retryCount === 0) {
        inFlightRef.current = slot.promise
      }
      return slot.promise
    },
    [scheduleRetry]
  )

  const setCurrentOrganization = useCallback(
    async (org: Organization | null) => {
      if (!org) {
        invalidateInFlight()
        setCurrentOrganizationState(null)
        return
      }

      // Invalidate list fetches/retries and prior selections; capture our generation.
      invalidateInFlight()
      const selectionGeneration = selectionGenerationRef.current

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
        if (!mountedRef.current) return
        if (selectionGeneration !== selectionGenerationRef.current) return
        setCurrentOrganizationState(data.organization)
      } catch (error) {
        console.error('Error setting current organization:', error)
      }
    },
    [invalidateInFlight]
  )

  const switchOrganization = useCallback(
    async (org: Organization) => {
      if (currentOrganization?.id === org.id) return

      invalidateInFlight()
      const selectionGeneration = selectionGenerationRef.current

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

        // Guard before reload: sign-out / another selection / unmount may have happened.
        if (!mountedRef.current) return
        if (selectionGeneration !== selectionGenerationRef.current) return

        window.location.reload()
      } catch (error) {
        console.error('Error switching organization:', error)
        if (mountedRef.current && selectionGeneration === selectionGenerationRef.current) {
          setIsSwitching(false)
        }
      }
    },
    [currentOrganization?.id, invalidateInFlight]
  )

  const refreshOrganizations = useCallback(async () => {
    await fetchOrganizations()
  }, [fetchOrganizations])

  useEffect(() => {
    mountedRef.current = true
    const supabase = createClient()

    const syncOrganizations = () => {
      if (!mountedRef.current) return
      void fetchOrganizations()
    }

    syncOrganizations()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!mountedRef.current) return
      if (event === 'SIGNED_OUT' || !session?.user) {
        invalidateInFlight()
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
      mountedRef.current = false
      invalidateInFlight()
      subscription.unsubscribe()
    }
  }, [fetchOrganizations, invalidateInFlight])

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
            <p className="text-sm text-muted-foreground font-medium">Switching organization...</p>
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
