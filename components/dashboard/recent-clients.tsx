'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/lib/organization-context'
import type { Client } from '@/types/database'
import { formatStatus, getStatusColor } from '@/lib/status-utils'

interface RecentClientsProps {
  initialClients: Client[]
  customStatuses: Array<{ key: string; label: string }>
}

export function RecentClients({ initialClients, customStatuses }: RecentClientsProps) {
  const { currentOrganization } = useOrganization()
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [loading, setLoading] = useState(false)

  const recentClients = useMemo(() => clients.slice(0, 5), [clients])

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
          .eq('owner_id', user.id)
          .or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`)
          .order('created_at', { ascending: false })
          .limit(5)

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
            .eq('owner_id', user.id)
            .or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`)
            .order('created_at', { ascending: false })
            .limit(5)
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Recent Clients
        </CardTitle>
        <CardDescription>Recently added clients</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && recentClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : recentClients.length > 0 ? (
          <div className="space-y-2">
            {recentClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="block rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{client.name}</p>
                    {client.company && (
                      <p className="text-sm text-muted-foreground">
                        {client.company}
                      </p>
                    )}
                  </div>
                  <Badge className={getStatusColor(client.status, client.client_type)}>
                    {formatStatus(client.status, customStatuses)}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No clients yet. Create your first client to get started.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
