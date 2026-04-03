'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { TrendingUp, Clock, Tag, List, LayoutDashboard, FileText, Users } from 'lucide-react'
import Link from 'next/link'
import type { Client } from '@/types/database'
import type { StatusConfig } from '@/types/settings'
import { RemindersCard } from '@/components/dashboard/reminders-card'
import { RecentClients } from '@/components/dashboard/recent-clients'
import { getUpcomingReminders, getCompletedReminders } from '@/app/actions/reminders'
import { getClients } from '@/app/actions/clients'
import { getDashboardStats } from '@/app/actions/stats'
import { getSettings } from '@/app/actions/settings'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/lib/organization-context'

const DASHBOARD_CACHE_TTL_MS = 30 * 60 * 1000
const DASHBOARD_CACHE_STORAGE_PREFIX = 'hostado:dashboard-cache:v1:'

type DashboardStats = {
  newLeadsWeek: number
  newLeadsMonth: number
  newTagLeads: number
  waitingForOffer: number
}

export type DashboardPermissionFlags = {
  hasAnyPermission: boolean
  hasDashboard: boolean
  hasClients: boolean
  hasReminders: boolean
  hasTodo: boolean
}

type DashboardCacheEntry = {
  fetchedAt: number
  reminders: any[]
  completedReminders: any[]
  clients: Client[]
  stats: DashboardStats
  customStatuses: StatusConfig[]
}

const dashboardMemoryCache = new Map<string, DashboardCacheEntry>()

function readDashboardCacheFromSession(orgId: string): DashboardCacheEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(`${DASHBOARD_CACHE_STORAGE_PREFIX}${orgId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DashboardCacheEntry
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null
    if (Date.now() - parsed.fetchedAt > DASHBOARD_CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeDashboardCacheToSession(orgId: string, entry: DashboardCacheEntry) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(`${DASHBOARD_CACHE_STORAGE_PREFIX}${orgId}`, JSON.stringify(entry))
  } catch {
    // ignore quota
  }
}

function buildCacheEntry(next: Omit<DashboardCacheEntry, 'fetchedAt'>): DashboardCacheEntry {
  return {
    fetchedAt: Date.now(),
    reminders: next.reminders,
    completedReminders: next.completedReminders,
    clients: next.clients,
    stats: next.stats,
    customStatuses: next.customStatuses,
  }
}

type DashboardPageClientProps = {
  permContext: DashboardPermissionFlags
  initialReminders: any[]
  initialCompletedReminders: any[]
  initialClients: Client[]
  initialStats: DashboardStats
  initialCustomStatuses: StatusConfig[]
}

export function DashboardPageClient({
  permContext,
  initialReminders,
  initialCompletedReminders,
  initialClients,
  initialStats,
  initialCustomStatuses,
}: DashboardPageClientProps) {
  const { currentOrganization, isLoading: orgContextLoading } = useOrganization()
  const orgId = currentOrganization?.id ?? null

  const [reminders, setReminders] = useState<any[]>(initialReminders)
  const [completedReminders, setCompletedReminders] = useState<any[]>(initialCompletedReminders)
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [customStatuses, setCustomStatuses] = useState<StatusConfig[]>(initialCustomStatuses)
  const [cardsReady, setCardsReady] = useState(false)

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(
    (entry: DashboardCacheEntry) => {
      if (!orgId) return
      dashboardMemoryCache.set(orgId, entry)
      writeDashboardCacheToSession(orgId, entry)
    },
    [orgId]
  )

  const fetchFresh = useCallback(async (): Promise<DashboardCacheEntry | null> => {
    if (!orgId) return null

    let nextReminders: any[] = []
    let nextCompleted: any[] = []
    let nextClients: Client[] = []
    let nextStats: DashboardStats = {
      newLeadsWeek: 0,
      newLeadsMonth: 0,
      newTagLeads: 0,
      waitingForOffer: 0,
    }
    let nextCustomStatuses: StatusConfig[] = []

    try {
      if (permContext.hasReminders) {
        const [up, done] = await Promise.all([getUpcomingReminders(), getCompletedReminders()])
        nextReminders = up || []
        nextCompleted = done || []
      }
      if (permContext.hasClients) {
        const [c, s, settings] = await Promise.all([
          getClients(),
          getDashboardStats(),
          getSettings().catch(() => ({ custom_statuses: [] as StatusConfig[] })),
        ])
        nextClients = c || []
        nextStats = s || nextStats
        nextCustomStatuses = settings.custom_statuses || []
      }

      return buildCacheEntry({
        reminders: nextReminders,
        completedReminders: nextCompleted,
        clients: nextClients,
        stats: nextStats,
        customStatuses: nextCustomStatuses,
      })
    } catch {
      return null
    }
  }, [orgId, permContext.hasClients, permContext.hasReminders])

  const applyEntry = useCallback((entry: DashboardCacheEntry) => {
    setReminders(entry.reminders)
    setCompletedReminders(entry.completedReminders)
    setClients(entry.clients)
    setStats(entry.stats)
    setCustomStatuses(entry.customStatuses)
  }, [])

  useLayoutEffect(() => {
    if (!orgId) return

    const fromSession = readDashboardCacheFromSession(orgId)
    const mem = dashboardMemoryCache.get(orgId)
    const cached =
      fromSession || (mem && Date.now() - mem.fetchedAt < DASHBOARD_CACHE_TTL_MS ? mem : null)
    if (cached) {
      dashboardMemoryCache.set(orgId, cached)
      applyEntry(cached)
      setCardsReady(true)
    }
  }, [orgId, applyEntry])

  useEffect(() => {
    if (!orgId) return
    let cancelled = false

    ;(async () => {
      const fresh = await fetchFresh()
      if (cancelled) return
      if (fresh) {
        applyEntry(fresh)
        persist(fresh)
      }
      setCardsReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [orgId, fetchFresh, applyEntry, persist])

  const scheduleRefresh = useCallback(() => {
    if (!orgId) return
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(async () => {
      refreshTimerRef.current = null
      const fresh = await fetchFresh()
      if (fresh) {
        applyEntry(fresh)
        persist(fresh)
      }
    }, 350)
  }, [orgId, fetchFresh, applyEntry, persist])

  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`dashboard-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `organization_id=eq.${orgId}`,
        },
        () => scheduleRefresh()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: `organization_id=eq.${orgId}`,
        },
        () => scheduleRefresh()
      )
      .subscribe()

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [orgId, scheduleRefresh])

  const { overdueReminders, todayReminders, upcomingReminders } = useMemo(() => {
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const overdue = reminders.filter((r: any) => {
      const dueDate = new Date(r.due_at)
      return dueDate < today && !r.done
    })
    const todayR = reminders.filter((r: any) => {
      const dueDate = new Date(r.due_at)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() === today.getTime() && !r.done
    })
    const upcoming = reminders.filter((r: any) => {
      const dueDate = new Date(r.due_at)
      return dueDate >= tomorrow && !r.done
    })
    return { overdueReminders: overdue, todayReminders: todayR, upcomingReminders: upcoming }
  }, [reminders])

  const showCardSkeletons =
    orgContextLoading || (Boolean(orgId) && !cardsReady)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      <div
        className={`grid gap-6 min-w-0 ${permContext.hasClients || permContext.hasReminders ? 'md:grid-cols-2' : ''}`}
      >
        {permContext.hasReminders && (
          <div className="min-w-0 overflow-hidden">
            <RemindersCard
              reminders={reminders}
              overdueReminders={overdueReminders}
              todayReminders={todayReminders}
              upcomingReminders={upcomingReminders}
              completedReminders={completedReminders}
              clients={clients}
              skeletonLoading={showCardSkeletons}
            />
          </div>
        )}

        {permContext.hasClients && (
          <div className="min-w-0 overflow-hidden">
            <RecentClients
              clients={clients}
              customStatuses={customStatuses}
              managedByParent
              parentLoading={showCardSkeletons}
            />
          </div>
        )}

        {!permContext.hasReminders && !permContext.hasClients && (
          <Card className="md:col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to your Dashboard</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Use the sidebar to navigate to Clients, Offers, Emails, To-Do List, or other sections you have access to.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link href="/clients">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Users className="h-4 w-4" />
                    Clients
                  </Button>
                </Link>
                <Link href="/offers">
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Offers
                  </Button>
                </Link>
                <Link href="/todo">
                  <Button variant="outline" size="sm" className="gap-2">
                    <List className="h-4 w-4" />
                    To-Do List
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {permContext.hasClients && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {showCardSkeletons ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-10 mb-2" />
                    <Skeleton className="h-3 w-36" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Leads (Week)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.newLeadsWeek}</div>
                  <p className="text-xs text-muted-foreground">Presales added this week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Leads (Month)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.newLeadsMonth}</div>
                  <p className="text-xs text-muted-foreground">Presales added this month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Leads with &quot;New&quot; Tag</CardTitle>
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.newTagLeads}</div>
                  <p className="text-xs text-muted-foreground">Within last 14 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Waiting for Offer</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.waitingForOffer}</div>
                  <p className="text-xs text-muted-foreground">Presales clients</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
