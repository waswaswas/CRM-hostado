'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Users, ChevronRight, Plus, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/lib/organization-context'
import type { Client } from '@/types/database'
import { formatStatus, getStatusColor } from '@/lib/status-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface RecentClientsProps {
  initialClients: Client[]
  customStatuses: Array<{ key: string; label: string }>
}

export function RecentClients({ initialClients, customStatuses }: RecentClientsProps) {
  const { currentOrganization } = useOrganization()
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [loading, setLoading] = useState(false)

  const recentClients = useMemo(() => clients.slice(0, 7), [clients])

  useEffect(() => {
    let isMounted = true
    const supabase = createClient()

    async function fetchRecentClients() {
      setLoading(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || !currentOrganization?.id) return

        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(7)

        if (isMounted) {
          setClients(data || [])
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (currentOrganization?.id) {
      fetchRecentClients()
    }

    return () => {
      isMounted = false
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    if (!currentOrganization?.id) return
    const supabase = createClient()

    const channel = supabase
      .channel(`recent-clients-${currentOrganization.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (!user) return
          const { data } = await supabase
            .from('clients')
            .select('*')
            .eq('organization_id', currentOrganization.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(7)
          setClients(data || [])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentOrganization?.id])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-5 w-5 text-muted-foreground shrink-0" />
              Recent Clients
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] px-3 md:h-8 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Quick add</span>
                  <ChevronDown className="h-4 w-4 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/clients/new?type=presales">Presales</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/clients/new?type=customer">Customer</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardDescription className="text-sm">Recently added clients</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && recentClients.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3.5">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : recentClients.length > 0 ? (
          <>
            <div className="space-y-2">
              {recentClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className={cn(
                    'flex items-center gap-3 sm:gap-3 rounded-xl border border-border bg-card p-4 sm:p-3.5',
                    'hover:bg-muted/50 dark:hover:bg-muted/30 hover:border-primary/30 transition-colors'
                  )}
                >
                  <div className="flex flex-1 min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-base sm:text-sm text-foreground break-words">{client.name}</p>
                      {client.company && (
                        <p className="text-sm sm:text-xs text-muted-foreground truncate mt-1">{client.company}</p>
                      )}
                    </div>
                    <Badge
                      className={cn(
                        'shrink-0 text-xs font-medium px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-md',
                        getStatusColor(client.status, client.client_type)
                      )}
                    >
                      {formatStatus(client.status, customStatuses)}
                    </Badge>
                  </div>
                  <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ))}
            </div>
            <Link
              href="/clients"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/30 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-primary/30 transition-colors"
            >
              View all clients
              <ChevronRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <div className="py-10 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No clients yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first client to get started</p>
            <Link
              href="/clients/new"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Add client
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
