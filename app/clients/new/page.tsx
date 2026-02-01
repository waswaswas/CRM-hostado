'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayoutClient } from '@/components/layout/app-layout-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClientRecord } from '@/app/actions/clients'
import { useToast } from '@/components/ui/toaster'
import { ClientStatus } from '@/types/database'
import { getStatusesForType, formatStatus, STATUS_DESCRIPTIONS } from '@/lib/status-utils'
import { getSettings } from '@/app/actions/settings'
import type { StatusConfig } from '@/types/settings'
import { ArrowLeft, User, Building2 } from 'lucide-react'

type ClientType = 'presales' | 'customer' | null
const SOURCE_OPTIONS = ['Phone Inbound', 'Phone Outbound', 'Chat', 'Email']
const CUSTOM_SOURCE_VALUE = '__custom__'

export default function NewClientPage() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const typeFromUrl = useMemo(() => {
    const t = searchParams.get('type')
    return t === 'presales' || t === 'customer' ? t : null
  }, [searchParams])
  const [clientType, setClientType] = useState<ClientType>(null)
  const [typeInitialized, setTypeInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sourceMode, setSourceMode] = useState<'preset' | 'custom'>('preset')
  const [customStatuses, setCustomStatuses] = useState<StatusConfig[]>([])
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    status: 'contacted' as ClientStatus, // Default to 'contacted' since 'new' is now a tag
    source: '',
    notes_summary: '',
  })

  // Load custom statuses on mount
  useEffect(() => {
    async function loadCustomStatuses() {
      try {
        const settings = await getSettings()
        setCustomStatuses(settings.custom_statuses || [])
      } catch (error) {
        console.warn('Failed to load custom statuses:', error)
      }
    }
    loadCustomStatuses()
  }, [])

  // Pre-select client type from URL (e.g. /clients/new?type=presales)
  useEffect(() => {
    if (typeInitialized) return
    setTypeInitialized(true)
    if (typeFromUrl) setClientType(typeFromUrl)
  }, [typeFromUrl, typeInitialized])

  // Update status when client type changes
  useEffect(() => {
    if (clientType) {
      const statuses = getStatusesForType(clientType, customStatuses)
      if (!statuses.includes(formData.status)) {
        setFormData((prev) => ({ ...prev, status: statuses[0] }))
      }
    }
  }, [clientType, customStatuses])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validation
    if (clientType === 'presales' && !formData.phone.trim()) {
      toast({
        title: 'Error',
        description: 'Phone number is required for Presales clients',
        variant: 'destructive',
      })
      return
    }

    if (clientType === 'customer' && !formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Name is required for Customer clients',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const client = await createClientRecord({
        name: formData.name || formData.phone, // Use phone as name if name not provided for presales
        company: formData.company || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        status: formData.status,
        client_type: clientType || undefined,
        source: formData.source || undefined,
        notes_summary: formData.notes_summary || undefined,
      })

      toast({
        title: 'Success',
        description: 'Client created successfully',
      })

      router.push(`/clients/${client.id}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create client',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (clientType === null) {
    return (
      <AppLayoutClient>
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">New Client</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Select Client Type</CardTitle>
              <CardDescription>Choose the type of client you want to create</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setClientType('presales')}
                  className="group relative rounded-lg border-2 border-dashed p-6 text-left transition-all hover:border-primary hover:bg-accent"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-full bg-primary/10 p-2">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Presales</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Quick add with phone number only. Perfect for cold calls and quick leads.
                  </p>
                  <div className="mt-4 text-xs text-muted-foreground">
                    <p className="font-medium">Required: Phone</p>
                    <p>Optional: Name, Email, Company, Notes</p>
                  </div>
                </button>

                <button
                  onClick={() => setClientType('customer')}
                  className="group relative rounded-lg border-2 border-dashed p-6 text-left transition-all hover:border-primary hover:bg-accent"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Customer</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Full client profile with all details. For established contacts and customers.
                  </p>
                  <div className="mt-4 text-xs text-muted-foreground">
                    <p className="font-medium">Required: Name</p>
                    <p>Optional: Email, Phone, Company, Notes</p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayoutClient>
    )
  }

  const isPresales = clientType === 'presales'

  return (
    <AppLayoutClient>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setClientType(null)}
            disabled={loading}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              New {isPresales ? 'Presales' : 'Customer'} Client
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isPresales
                ? 'Quick add - only phone number is required'
                : 'Complete client information'}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>
              {isPresales
                ? 'Enter the details for the new presales lead'
                : 'Enter the details for the new client'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isPresales && (
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required={!isPresales}
                    disabled={loading}
                    placeholder="Client name"
                  />
                </div>
              )}

              {isPresales && (
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={loading}
                    placeholder="Optional - will use phone if not provided"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone {isPresales && <span className="text-destructive">*</span>}
                </label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required={isPresales}
                  disabled={loading}
                  placeholder="Phone number"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="company" className="text-sm font-medium">
                  Company
                </label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  disabled={loading}
                  placeholder="Company name"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading}
                  placeholder="Email address"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="status" className="text-sm font-medium">
                    Status
                  </label>
                  <Select
                    id="status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as ClientStatus })
                    }
                    disabled={loading}
                  >
                    {getStatusesForType(clientType, customStatuses).map((status) => (
                      <option key={status} value={status} title={STATUS_DESCRIPTIONS[status as keyof typeof STATUS_DESCRIPTIONS] || ''}>
                        {formatStatus(status, customStatuses)}
                      </option>
                    ))}
                  </Select>
                  {formData.status && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {STATUS_DESCRIPTIONS[formData.status as keyof typeof STATUS_DESCRIPTIONS] || 'Custom status'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="source" className="text-sm font-medium">
                    Source
                  </label>
                  <Select
                    id="source"
                    value={sourceMode === 'custom' ? CUSTOM_SOURCE_VALUE : formData.source}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === CUSTOM_SOURCE_VALUE) {
                        setSourceMode('custom')
                        setFormData({ ...formData, source: '' })
                      } else {
                        setSourceMode('preset')
                        setFormData({ ...formData, source: value })
                      }
                    }}
                    disabled={loading}
                  >
                    <option value="">Select source</option>
                    {SOURCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={CUSTOM_SOURCE_VALUE}>Custom...</option>
                  </Select>
                  {sourceMode === 'custom' && (
                    <Input
                      id="source-custom"
                      placeholder="Custom source"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      disabled={loading}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="notes_summary" className="text-sm font-medium">
                  Notes
                </label>
                <Textarea
                  id="notes_summary"
                  placeholder="Brief summary or notes about this client..."
                  value={formData.notes_summary}
                  onChange={(e) =>
                    setFormData({ ...formData, notes_summary: e.target.value })
                  }
                  disabled={loading}
                  rows={4}
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : `Create ${isPresales ? 'Presales' : 'Customer'} Client`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayoutClient>
  )
}



