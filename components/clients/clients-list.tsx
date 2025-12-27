'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Client, ClientStatus, ClientType } from '@/types/database'
import Link from 'next/link'
import { Plus, Search, Trash2, Calendar, Link as LinkIcon } from 'lucide-react'
import { format, subDays, isAfter, startOfDay, endOfDay } from 'date-fns'
import { getStatusesForType, getStatusColor, formatStatus, STATUS_DESCRIPTIONS, isClientNew } from '@/lib/status-utils'
import { deleteClient, updateClient } from '@/app/actions/clients'
import { useToast } from '@/components/ui/toaster'
import { getSettings } from '@/app/actions/settings'
import type { StatusConfig } from '@/types/settings'

interface ClientsListProps {
  initialClients: Client[]
  linkedClientIds?: string[]
}

export function ClientsList({ initialClients, linkedClientIds = [] }: ClientsListProps) {
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [filteredClients, setFilteredClients] = useState<Client[]>(initialClients)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ClientType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all')
  const [newFilter, setNewFilter] = useState<'all' | 'new'>('all')
  const [dateFilter, setDateFilter] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [showNewToggle, setShowNewToggle] = useState(false)
  const [editingClient, setEditingClient] = useState<{ id: string; field: 'status' | 'type' } | null>(null)
  const [customStatuses, setCustomStatuses] = useState<StatusConfig[]>([])
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())

  // Load custom statuses on mount
  useEffect(() => {
    async function loadCustomStatuses() {
      try {
        const settings = await getSettings()
        setCustomStatuses(settings.custom_statuses || [])
      } catch (error) {
        // Silently fail - custom statuses are optional
        console.warn('Failed to load custom statuses:', error)
      }
    }
    loadCustomStatuses()
  }, [])

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

    // New filter (Presales added within 14 days - "New" is now a tag, not a status)
    if (newFilter === 'new') {
      filtered = filtered.filter((client) => {
        // Only show presales clients that are "new" (within 14 days)
        if (!client.client_type || client.client_type !== 'presales') return false
        return isClientNew(client.created_at)
      })
    }

    // Date range filter
    if (dateFilter.from) {
      const fromDate = startOfDay(new Date(dateFilter.from))
      filtered = filtered.filter((client) => {
        const createdDate = new Date(client.created_at)
        return createdDate >= fromDate
      })
    }
    if (dateFilter.to) {
      const toDate = endOfDay(new Date(dateFilter.to))
      filtered = filtered.filter((client) => {
        const createdDate = new Date(client.created_at)
        return createdDate <= toDate
      })
    }

    setFilteredClients(filtered)
  }, [search, typeFilter, statusFilter, newFilter, dateFilter, clients])

  async function handleDeleteClient(clientId: string, clientName: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm(`Are you sure you want to delete "${clientName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteClient(clientId)
      setClients((prev) => prev.filter((c) => c.id !== clientId))
      setSelectedClients((prev) => {
        const newSet = new Set(prev)
        newSet.delete(clientId)
        return newSet
      })
      toast({
        title: 'Success',
        description: 'Client deleted successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete client',
        variant: 'destructive',
      })
    }
  }

  function handleToggleSelect(clientId: string) {
    setSelectedClients((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(clientId)) {
        newSet.delete(clientId)
      } else {
        newSet.add(clientId)
      }
      return newSet
    })
  }

  function handleSelectAll() {
    if (selectedClients.size === filteredClients.length) {
      // Deselect all
      setSelectedClients(new Set())
    } else {
      // Select all filtered clients
      setSelectedClients(new Set(filteredClients.map((c) => c.id)))
    }
  }

  async function handleBulkDelete() {
    if (selectedClients.size === 0) return

    const count = selectedClients.size
    if (!confirm(`Are you sure you want to delete ${count} client${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return
    }

    const selectedIds = Array.from(selectedClients)
    let successCount = 0
    let failCount = 0

    try {
      // Delete clients one by one
      const failedClientIds: string[] = []
      for (const clientId of selectedIds) {
        try {
          await deleteClient(clientId)
          successCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(`Failed to delete client ${clientId}:`, errorMessage, error)
          failCount++
          // Find the client name for better error message
          const failedClient = clients.find(c => c.id === clientId)
          if (failedClient) {
            failedClientIds.push(failedClient.name)
          } else {
            failedClientIds.push(clientId.substring(0, 8))
          }
          
          // Log specific error to help debug
          if (errorMessage.includes('foreign key') || errorMessage.includes('constraint')) {
            console.error(`Client ${clientId} cannot be deleted due to related records.`)
            console.error(`Error details: ${errorMessage}`)
            console.error(`Solution: Run the migration: supabase/migration_fix_interactions_email_cascade.sql`)
          }
        }
      }

      // Update the clients list - only remove successfully deleted clients
      setClients((prev) => prev.filter((c) => {
        // Keep clients that failed to delete
        return !selectedIds.includes(c.id) || failedClientIds.some(name => 
          name === c.name || name === c.id.substring(0, 8)
        )
      }))
      
      // Only clear selection for successfully deleted clients
      setSelectedClients((prev) => {
        const newSet = new Set(prev)
        selectedIds.forEach(id => {
          if (!failedClientIds.some(name => {
            const client = clients.find(c => c.id === id)
            return client && (name === client.name || name === id.substring(0, 8))
          })) {
            newSet.delete(id)
          }
        })
        return newSet
      })

      if (failCount === 0) {
        toast({
          title: 'Success',
          description: `Successfully deleted ${successCount} client${successCount > 1 ? 's' : ''}`,
        })
      } else {
        const failedNames = failedClientIds.length > 0 
          ? failedClientIds.slice(0, 3).join(', ') + (failedClientIds.length > 3 ? '...' : '')
          : 'some clients'
        toast({
          title: 'Partial Success',
          description: `Deleted ${successCount} client${successCount > 1 ? 's' : ''}, ${failCount} failed${failedNames ? `: ${failedNames}` : ''}. Check console for details.`,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete clients',
        variant: 'destructive',
      })
    }
  }

  async function handleStatusChange(clientId: string, newStatus: ClientStatus) {
    try {
      const updated = await updateClient(clientId, { status: newStatus })
      setClients((prev) => prev.map((c) => (c.id === clientId ? updated : c)))
      setEditingClient(null)
      toast({
        title: 'Success',
        description: 'Status updated',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      // If it's a constraint violation, provide helpful message
      if (errorMessage.includes('check constraint') || errorMessage.includes('violates check constraint')) {
        console.error('Database constraint error. Please run: supabase/ALLOW_CUSTOM_STATUSES.sql')
      }
    }
  }

  async function handleTypeChange(clientId: string, newType: ClientType, currentStatus: ClientStatus) {
    try {
      // When changing type, also update status to first valid status for new type
      const validStatuses = getStatusesForType(newType, customStatuses)
      const newStatus = validStatuses.includes(currentStatus) ? currentStatus : validStatuses[0]
      
      const updated = await updateClient(clientId, { 
        client_type: newType,
        status: newStatus 
      })
      setClients((prev) => prev.map((c) => (c.id === clientId ? updated : c)))
      setEditingClient(null)
      toast({
        title: 'Success',
        description: 'Client type updated',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update client type',
        variant: 'destructive',
      })
    }
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
              {getStatusesForType(typeFilter === 'all' ? null : typeFilter, customStatuses).map((status) => (
                <option key={status} value={status} title={STATUS_DESCRIPTIONS[status as keyof typeof STATUS_DESCRIPTIONS] || ''}>
                  {formatStatus(status, customStatuses)}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Time Filter</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="new-toggle"
                  checked={newFilter === 'new'}
                  onChange={(e) => setNewFilter(e.target.checked ? 'new' : 'all')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="new-toggle" className="text-sm cursor-pointer">
                  New only (within 14 days)
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">From</label>
                  <Input
                    type="date"
                    value={dateFilter.from}
                    onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">To</label>
                  <Input
                    type="date"
                    value={dateFilter.to}
                    onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>
              {(dateFilter.from || dateFilter.to) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateFilter({ from: '', to: '' })}
                  className="w-full text-xs"
                >
                  Clear dates
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {filteredClients.length > 0 ? (
        <div className="space-y-4">
          {/* Bulk Actions Bar */}
          {selectedClients.size > 0 && (
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedClients.size} client{selectedClients.size > 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClients(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Select All Checkbox */}
          <div className="flex items-center gap-2 pb-2 border-b">
            <input
              type="checkbox"
              checked={filteredClients.length > 0 && selectedClients.size === filteredClients.length}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300 cursor-pointer"
            />
            <label className="text-sm font-medium cursor-pointer" onClick={handleSelectAll}>
              Select All ({filteredClients.length})
            </label>
          </div>

          <div className="grid gap-4">
            {filteredClients.map((client) => (
              <Card key={client.id} className="transition-colors hover:bg-accent">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedClients.has(client.id)}
                        onChange={() => handleToggleSelect(client.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Link href={`/clients/${client.id}`} className="text-lg font-semibold hover:underline">
                            {client.name}
                          </Link>
                          {/* "New" tag - separate, non-editable, auto-removed after 14 days */}
                          {client.client_type === 'presales' && isClientNew(client.created_at) && (
                            <Badge 
                              className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              title="Added within the last 14 days"
                            >
                              New
                            </Badge>
                          )}
                          {linkedClientIds.includes(client.id) && (
                            <Badge 
                              className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 flex items-center gap-1"
                              title="Linked to accounting customer"
                            >
                              <LinkIcon className="h-3 w-3" />
                              Accounting
                            </Badge>
                          )}
                          {editingClient?.id === client.id && editingClient.field === 'type' ? (
                            <Select
                              value={client.client_type || 'presales'}
                              onChange={(e) => {
                                handleTypeChange(client.id, e.target.value as ClientType, client.status)
                              }}
                              onBlur={() => setEditingClient(null)}
                              className="w-32 text-xs"
                              autoFocus
                            >
                              <option value="presales">Presales</option>
                              <option value="customer">Customer</option>
                            </Select>
                          ) : (
                            <Badge 
                              className={`text-xs cursor-pointer hover:opacity-80 ${
                                client.client_type === 'presales' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                                  : client.client_type === 'customer'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                              }`}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setEditingClient({ id: client.id, field: 'type' })
                              }}
                              title="Click to change client type"
                            >
                              {client.client_type === 'presales' ? 'Presales' : client.client_type === 'customer' ? 'Customer' : 'Unknown'}
                            </Badge>
                          )}
                          {editingClient?.id === client.id && editingClient.field === 'status' ? (
                            <Select
                              value={client.status}
                              onChange={(e) => {
                                handleStatusChange(client.id, e.target.value as ClientStatus)
                              }}
                              onBlur={() => setEditingClient(null)}
                              className="w-40 text-xs"
                              autoFocus
                            >
                              {getStatusesForType(client.client_type, customStatuses).map((status) => (
                                <option key={status} value={status}>
                                  {formatStatus(status, customStatuses)}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Badge 
                              className={`${getStatusColor(client.status, client.client_type)} cursor-pointer hover:opacity-80`}
                              title={STATUS_DESCRIPTIONS[client.status as keyof typeof STATUS_DESCRIPTIONS] || ''}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setEditingClient({ id: client.id, field: 'status' })
                              }}
                            >
                              {formatStatus(client.status, customStatuses)}
                            </Badge>
                          )}
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
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Added {format(new Date(client.created_at), 'MMM d, yyyy')}</p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteClient(client.id, client.name, e)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete client"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {search || typeFilter !== 'all' || statusFilter !== 'all' || newFilter !== 'all' || dateFilter.from || dateFilter.to
                ? 'No clients match your filters.'
                : 'No clients yet. Create your first client to get started.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}



