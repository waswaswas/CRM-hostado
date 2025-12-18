'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Offer, OfferStatus, PaymentStatus } from '@/types/database'
import Link from 'next/link'
import { Plus, Search, Trash2, Copy, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { deleteOffer, duplicateOffer, generatePaymentLink, markOfferAsPaid } from '@/app/actions/offers'
import { useToast } from '@/components/ui/toaster'
import { getClients } from '@/app/actions/clients'
import type { Client } from '@/types/database'

interface OffersListProps {
  initialOffers: Offer[]
}

export function OffersList({ initialOffers }: OffersListProps) {
  const { toast } = useToast()
  const [offers, setOffers] = useState<Offer[]>(initialOffers)
  const [clients, setClients] = useState<Client[]>([])
  const [filteredOffers, setFilteredOffers] = useState<Offer[]>(initialOffers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OfferStatus | 'all'>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | 'all' | 'not_paid'>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')

  useEffect(() => {
    async function loadClients() {
      try {
        const clientsData = await getClients()
        setClients(clientsData)
      } catch (error) {
        console.error('Failed to load clients:', error)
      }
    }
    loadClients()
  }, [])

  useEffect(() => {
    let filtered = [...offers]

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter((offer) => {
        const client = clients.find(c => c.id === offer.client_id)
        return (
          offer.title?.toLowerCase().includes(searchLower) ||
          offer.description?.toLowerCase().includes(searchLower) ||
          client?.name?.toLowerCase().includes(searchLower)
        )
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((offer) => offer.status === statusFilter)
    }

    // Payment status filter
    if (paymentStatusFilter !== 'all') {
      if (paymentStatusFilter === 'not_paid') {
        filtered = filtered.filter((offer) => 
          offer.payment_status !== 'completed' && offer.status !== 'paid'
        )
      } else {
        filtered = filtered.filter((offer) => offer.payment_status === paymentStatusFilter)
      }
    }

    // Client filter
    if (clientFilter !== 'all') {
      filtered = filtered.filter((offer) => offer.client_id === clientFilter)
    }

    setFilteredOffers(filtered)
  }, [search, statusFilter, paymentStatusFilter, clientFilter, offers, clients])

  async function handleDeleteOffer(offerId: string, offerTitle: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm(`Are you sure you want to delete "${offerTitle}"?`)) {
      return
    }

    try {
      await deleteOffer(offerId)
      setOffers((prev) => prev.filter((o) => o.id !== offerId))
      toast({
        title: 'Success',
        description: 'Offer deleted successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete offer',
        variant: 'destructive',
      })
    }
  }

  async function handleDuplicateOffer(offerId: string) {
    try {
      const duplicated = await duplicateOffer(offerId)
      setOffers((prev) => [duplicated, ...prev])
      toast({
        title: 'Success',
        description: 'Offer duplicated successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate offer',
        variant: 'destructive',
      })
    }
  }

  async function handleGeneratePaymentLink(offerId: string) {
    try {
      const link = await generatePaymentLink(offerId)
      // Redirect user to the public payment page instead of copying to clipboard
      if (typeof window !== 'undefined') {
        window.open(link, '_blank')
      }
      toast({
        title: 'Success',
        description: 'Redirecting to payment page...',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate payment link',
        variant: 'destructive',
      })
    }
  }

  function getStatusColor(status: OfferStatus) {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      case 'sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'expired':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      case 'pending_payment':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  function getPaymentStatusBadge(offer: Offer) {
    if (offer.status === 'paid' || offer.payment_status === 'completed') {
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Paid</Badge>
    }
    if (offer.payment_status === 'pending' || offer.status === 'pending_payment') {
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Pending Payment</Badge>
    }
    if (offer.payment_enabled && offer.status !== 'draft') {
      return <Badge variant="outline">Not Paid</Badge>
    }
    return null
  }

  function getStatusLabel(status: OfferStatus) {
    const statusLabels: Record<OfferStatus, string> = {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted',
      rejected: 'Rejected',
      expired: 'Expired',
      paid: 'Paid',
      pending_payment: 'Pending Payment',
    }
    return statusLabels[status] || status
  }

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    return client?.name || 'Unknown Client'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Offers</h1>
        <Link href="/offers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Offer
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search offers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OfferStatus | 'all')}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              <option value="paid">Paid</option>
              <option value="pending_payment">Pending Payment</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Status</label>
            <Select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as PaymentStatus | 'all' | 'not_paid')}
            >
              <option value="all">All</option>
              <option value="completed">Paid</option>
              <option value="pending">Pending Payment</option>
              <option value="not_paid">Not Paid</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Client</label>
            <Select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="all">All</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {filteredOffers.length > 0 ? (
        <div className="grid gap-4">
          {filteredOffers.map((offer) => (
            <Card key={offer.id} className="transition-colors hover:bg-accent">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <Link href={`/offers/${offer.id}`} className="text-lg font-semibold hover:underline">
                        {offer.title}
                      </Link>
                      <Badge className={getStatusColor(offer.status)}>
                        {getStatusLabel(offer.status)}
                      </Badge>
                      {getPaymentStatusBadge(offer)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <Link href={`/clients/${offer.client_id}`} className="hover:underline">
                        {getClientName(offer.client_id)}
                      </Link>
                      <span className="font-semibold text-foreground">
                        {offer.amount} {offer.currency}
                      </span>
                    </div>
                    {offer.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {offer.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Added {format(new Date(offer.created_at), 'MMM d, yyyy')}</span>
                      {offer.valid_until && (
                        <span>Valid until: {format(new Date(offer.valid_until), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/offers/${offer.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    {offer.payment_enabled && offer.payment_token && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGeneratePaymentLink(offer.id)}
                        title="Copy Payment Link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicateOffer(offer.id)}
                      title="Duplicate Offer"
                    >
                      Duplicate
                    </Button>
                    <button
                      onClick={(e) => handleDeleteOffer(offer.id, offer.title, e)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete Offer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {search || statusFilter !== 'all' || paymentStatusFilter !== 'all' || clientFilter !== 'all'
                ? 'No offers found matching your filters'
                : 'No offers found. Create your first offer to get started.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}






