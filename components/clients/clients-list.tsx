'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Client, ClientStatus, ClientType } from '@/types/database'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { format, subDays, isAfter } from 'date-fns'

interface ClientsListProps {
  initialClients: Client[]
}

export function ClientsList({ initialClients }: ClientsListProps) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [filteredClients, setFilteredClients] = useState<Client[]>(initialClients)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ClientType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all')
  const [newFilter, setNewFilter] = useState<'all' | 'new'>('all')

  useEffect(() => {
    let filtered = clients

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (client) =>
          client.name.toLowerCase().includes(searchLower) ||
          client.company?.toLowerCase().includes(searchLower) ||
          client.email?.toLowerCase().includes(searchLower) ||
          client.phone?.toLowerCase().includes(searchLower)
      )
    }

    // Type filter (Presales or Customer)
    if (typeFilter !== 'all') {
      filtered = filtered.filter((client) => {
        // Handle cases where client_type might be null or undefined
        return client.client_type === typeFilter
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((client) => client.status === statusFilter)
    }

    // New filter (Presales added within 14 days)
    if (newFilter === 'new') {
      const fourteenDaysAgo = subDays(new Date(), 14)
      filtered = filtered.filter((client) => {
        // Only show presales clients
        if (!client.client_type || client.client_type !== 'presales') return false
        const createdAt = new Date(client.created_at)
        return isAfter(createdAt, fourteenDaysAgo)
      })
    }

    setFilteredClients(filtered)
  }, [search, typeFilter, statusFilter, newFilter, clients])

  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case 'new':
      case 'to_be_contacted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'contacted':
      case 'waiting_for_response':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'in_progress':
      case 'waiting_for_offer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'won':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'lost':
      case 'abandoned':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const formatStatus = (status: ClientStatus) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Clients</h1>
        <Link href="/clients/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Client Type</label>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ClientType | 'all')}
            >
              <option value="all">All Types</option>
              <option value="presales">Presales</option>
              <option value="customer">Customer</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Lead Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ClientStatus | 'all')}
            >
              <option value="all">All Statuses</option>
              <option value="to_be_contacted">To be contacted</option>
              <option value="waiting_for_response">Waiting for response</option>
              <option value="waiting_for_offer">Waiting for offer</option>
              <option value="abandoned">Abandoned</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="in_progress">In Progress</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Time Filter</label>
            <Select
              value={newFilter}
              onChange={(e) => setNewFilter(e.target.value as 'all' | 'new')}
            >
              <option value="all">All</option>
              <option value="new">New (Last 14 days)</option>
            </Select>
          </div>
        </div>
      </div>

      {filteredClients.length > 0 ? (
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{client.name}</h3>
                        {client.client_type && (
                          <Badge variant="outline" className="text-xs">
                            {client.client_type === 'presales' ? 'Presales' : 'Customer'}
                          </Badge>
                        )}
                        <Badge className={getStatusColor(client.status)}>
                          {formatStatus(client.status)}
                        </Badge>
                      </div>
                      {client.company && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {client.company}
                        </p>
                      )}
                      <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                        {client.email && <span>{client.email}</span>}
                        {client.phone && <span>{client.phone}</span>}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Added {format(new Date(client.created_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {search || typeFilter !== 'all' || statusFilter !== 'all' || newFilter !== 'all'
                ? 'No clients match your filters.'
                : 'No clients yet. Create your first client to get started.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
