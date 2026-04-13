'use client'

import { useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { Client, Interaction, Reminder, ClientNote, ClientStatus, ClientType, Offer } from '@/types/database'
import {
  getStatusesForType,
  getStatusColor,
  formatStatus,
  STATUS_DESCRIPTIONS,
  getClientStatusBadgeProps,
} from '@/lib/status-utils'
import type { StatusConfig } from '@/types/settings'
import { useOrganization } from '@/lib/organization-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import {
  getInteractionsForClient,
  createInteraction,
  deleteInteraction,
} from '@/app/actions/interactions'
import {
  getRemindersForClient,
  createReminder,
  markReminderDone,
  updateReminder,
  deleteReminder,
} from '@/app/actions/reminders'
import { getNotesForClient, createNote, updateNote, toggleNotePin, deleteNote } from '@/app/actions/notes'
import { getOffersForClient } from '@/app/actions/offers'
import { updateClient } from '@/app/actions/clients'
import { useToast } from '@/components/ui/toaster'
import { format } from 'date-fns'
import Link from 'next/link'
import {
  Phone,
  Mail,
  Calendar,
  Plus,
  Check,
  X,
  Pin,
  PinOff,
  Trash2,
  Edit,
  Link as LinkIcon,
  Unlink,
  Copy,
} from 'lucide-react'

import { AccountingCustomerWithRelations } from '@/types/database'
import { LinkAccountingCustomerDialog } from './link-accounting-customer-dialog'
import { cn } from '@/lib/utils'

const SOURCE_OPTIONS = ['Phone Inbound', 'Phone Outbound', 'Chat', 'Email']
const CUSTOM_SOURCE_VALUE = '__custom__'

const CLIENT_DETAIL_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

type ClientDetailCacheEntry = {
  fetchedAt: number
  interactions: Interaction[]
  reminders: Reminder[]
  notes: ClientNote[]
  offers: Offer[]
}

// In-memory cache for faster back/forward navigation.
const clientDetailCache = new Map<string, ClientDetailCacheEntry>()

const CLIENT_DETAIL_CACHE_STORAGE_PREFIX = 'hostado:client-detail-cache:v1:'

function readClientDetailCacheFromSession(clientId: string): ClientDetailCacheEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(`${CLIENT_DETAIL_CACHE_STORAGE_PREFIX}${clientId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ClientDetailCacheEntry
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null
    if (Date.now() - parsed.fetchedAt > CLIENT_DETAIL_CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeClientDetailCacheToSession(clientId: string, entry: ClientDetailCacheEntry) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      `${CLIENT_DETAIL_CACHE_STORAGE_PREFIX}${clientId}`,
      JSON.stringify(entry)
    )
  } catch {
    // ignore quota/security errors
  }
}

interface ClientDetailProps {
  client: Client
  linkedAccountingCustomers?: AccountingCustomerWithRelations[]
  initialCustomStatuses?: StatusConfig[]
}

export function ClientDetail({
  client: initialClient,
  linkedAccountingCustomers = [],
  initialCustomStatuses = [],
}: ClientDetailProps) {
  const { toast } = useToast()
  const [client, setClient] = useState(initialClient)
  // IMPORTANT: Keep initial render identical on server + client to avoid hydration mismatch.
  // We'll hydrate from sessionStorage in `useLayoutEffect` (client-only) before paint.
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [showInteractionDialog, setShowInteractionDialog] = useState(false)
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [showReminderEditDialog, setShowReminderEditDialog] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [detailTab, setDetailTab] = useState('timeline')
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingType, setEditingType] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [sourceEditMode, setSourceEditMode] = useState<'preset' | 'custom'>('preset')
  const [editValues, setEditValues] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: '',
    notes_summary: '',
  })
  const [customStatuses, setCustomStatuses] = useState<StatusConfig[]>(initialCustomStatuses)
  const [showLinkMenu, setShowLinkMenu] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')

  // customStatuses is provided by the server to avoid an initial "partial statuses" render.

  const { currentOrganization } = useOrganization()

  useEffect(() => {
    const organizationId = currentOrganization?.id
    if (!organizationId) return
    let isMounted = true
    const supabase = createClient()
    let channel: any = null

    async function loadSettings() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('settings')
          .select('custom_statuses')
          .eq('owner_id', user.id)
          .eq('organization_id', organizationId)
          .single()

        if (!isMounted) return
        if (error) return
        setCustomStatuses((data?.custom_statuses as StatusConfig[]) || [])
      } catch {
        // ignore realtime/settings errors - keep initial statuses
      }
    }

    async function start() {
      await loadSettings()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`client-detail-settings-${organizationId}-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'settings',
            filter: `organization_id=eq.${organizationId}`,
          },
          () => {
            void loadSettings()
          }
        )
        .subscribe()
    }

    void start()

    return () => {
      isMounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [currentOrganization?.id])

  useLayoutEffect(() => {
    const clientId = client.id

    // Hydrate synchronously from sessionStorage (client-only) before paint.
    // This keeps the first client render aligned with the server HTML (no cache-dependent render),
    // then swaps to cached data immediately.
    const cachedFromSession = readClientDetailCacheFromSession(clientId)
    if (cachedFromSession) {
      clientDetailCache.set(clientId, cachedFromSession)
      setInteractions(cachedFromSession.interactions)
      setReminders(cachedFromSession.reminders)
      setNotes(cachedFromSession.notes)
      setOffers(cachedFromSession.offers)
      setLoading(false)
      // Stale-while-revalidate: keep instant cached render, then refresh from DB in background.
      void loadData({ forceNetwork: true, background: true })
      return
    }

    loadData()
  }, [client.id])

  async function loadData(options?: { forceNetwork?: boolean; background?: boolean }) {
    const clientId = client.id

    const forceNetwork = options?.forceNetwork === true
    const background = options?.background === true

    // When forcing network, bypass both sessionStorage hydration and in-memory cache.
    // This is important after mutations (notes/reminders/interactions) where the cached entry
    // may still be stale.
    if (forceNetwork) {
      if (!background) {
        setLoading(true)
      }
      try {
        const [interactionsData, remindersData, notesData, offersData] = await Promise.allSettled([
          getInteractionsForClient(clientId),
          getRemindersForClient(clientId),
          getNotesForClient(clientId),
          getOffersForClient(clientId),
        ])

        const nextInteractions =
          interactionsData.status === 'fulfilled' ? interactionsData.value : []
        const nextReminders =
          remindersData.status === 'fulfilled' ? remindersData.value : []
        const nextNotes =
          notesData.status === 'fulfilled' ? notesData.value : []
        const nextOffers =
          offersData.status === 'fulfilled' ? offersData.value : []

        setInteractions(nextInteractions)
        setReminders(nextReminders)
        setNotes(nextNotes)
        setOffers(nextOffers)

        const entry: ClientDetailCacheEntry = {
          fetchedAt: Date.now(),
          interactions: nextInteractions,
          reminders: nextReminders,
          notes: nextNotes,
          offers: nextOffers,
        }
        clientDetailCache.set(clientId, entry)
        writeClientDetailCacheToSession(clientId, entry)
      } catch (error) {
        console.error('Unexpected error loading client data:', error)
        toast({
          title: 'Error',
          description: 'Failed to load some client data. Please check the browser console.',
          variant: 'destructive',
        })
      } finally {
        if (!background) {
          setLoading(false)
        }
      }

      return
    }

    // 1) Prefer sessionStorage so a full refresh can still hydrate quickly.
    const cachedFromSession = readClientDetailCacheFromSession(clientId)
    if (cachedFromSession) {
      clientDetailCache.set(clientId, cachedFromSession)
      setInteractions(cachedFromSession.interactions)
      setReminders(cachedFromSession.reminders)
      setNotes(cachedFromSession.notes)
      setOffers(cachedFromSession.offers)
      setLoading(false)
      // Keep data fresh even when cache hits.
      void loadData({ forceNetwork: true, background: true })
      return
    }

    // 2) Fallback to in-memory cache (works for navigation back/forward).
    const cached = clientDetailCache.get(clientId)
    const isFresh = cached && Date.now() - cached.fetchedAt < CLIENT_DETAIL_CACHE_TTL_MS
    if (isFresh && cached) {
      setInteractions(cached.interactions)
      setReminders(cached.reminders)
      setNotes(cached.notes)
      setOffers(cached.offers)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [interactionsData, remindersData, notesData, offersData] = await Promise.allSettled([
        getInteractionsForClient(clientId),
        getRemindersForClient(clientId),
        getNotesForClient(clientId),
        getOffersForClient(clientId),
      ])

      const nextInteractions =
        interactionsData.status === 'fulfilled' ? interactionsData.value : []
      const nextReminders =
        remindersData.status === 'fulfilled' ? remindersData.value : []
      const nextNotes =
        notesData.status === 'fulfilled' ? notesData.value : []
      const nextOffers =
        offersData.status === 'fulfilled' ? offersData.value : []

      if (interactionsData.status !== 'fulfilled') {
        console.error('Failed to load interactions:', interactionsData.reason)
      }
      if (remindersData.status !== 'fulfilled') {
        console.error('Failed to load reminders:', remindersData.reason)
      }
      if (notesData.status !== 'fulfilled') {
        console.error('Failed to load notes:', notesData.reason)
      }
      if (offersData.status !== 'fulfilled') {
        console.error('Failed to load offers:', offersData.reason)
      }

      setInteractions(nextInteractions)
      setReminders(nextReminders)
      setNotes(nextNotes)
      setOffers(nextOffers)

      const entry: ClientDetailCacheEntry = {
        fetchedAt: Date.now(),
        interactions: nextInteractions,
        reminders: nextReminders,
        notes: nextNotes,
        offers: nextOffers,
      }

      clientDetailCache.set(clientId, entry)
      writeClientDetailCacheToSession(clientId, entry)
    } catch (error) {
      console.error('Unexpected error loading client data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load some client data. Please check the browser console.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  function syncClientDetailCacheForReminders(nextReminders: Reminder[]) {
    const entry: ClientDetailCacheEntry = {
      fetchedAt: Date.now(),
      interactions,
      reminders: nextReminders,
      notes,
      offers,
    }
    clientDetailCache.set(client.id, entry)
    writeClientDetailCacheToSession(client.id, entry)
  }

  function syncClientDetailCacheForInteractions(nextInteractions: Interaction[]) {
    const cached = clientDetailCache.get(client.id)
    const entry: ClientDetailCacheEntry = {
      fetchedAt: Date.now(),
      interactions: nextInteractions,
      reminders: cached?.reminders ?? reminders,
      notes: cached?.notes ?? notes,
      offers: cached?.offers ?? offers,
    }
    clientDetailCache.set(client.id, entry)
    writeClientDetailCacheToSession(client.id, entry)
  }

  async function handleStatusChange(newStatus: ClientStatus) {
    try {
      const updated = await updateClient(client.id, { status: newStatus })
      setClient(updated)
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
    setEditingStatus(false)
  }

  async function handleTypeChange(newType: ClientType) {
    try {
      // Keep current status if valid for the new type; otherwise fallback to first valid one.
      const validStatuses = getStatusesForType(newType, customStatuses)
      const nextStatus = validStatuses.includes(client.status) ? client.status : validStatuses[0]
      const updated = await updateClient(client.id, {
        client_type: newType,
        status: nextStatus,
      })
      setClient(updated)
      toast({
        title: 'Success',
        description: 'Client type updated',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update client type',
        variant: 'destructive',
      })
    } finally {
      setEditingType(false)
    }
  }

  function startEditing(field: string) {
    setEditingField(field)
    setEditValues({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      company: client.company || '',
      source: client.source || '',
      notes_summary: client.notes_summary || '',
    })
    if (field === 'source') {
      const initialSource = client.source || ''
      setSourceEditMode(SOURCE_OPTIONS.includes(initialSource) ? 'preset' : 'custom')
    }
  }

  async function saveField(field: string) {
    try {
      const updateData: any = {}
      updateData[field] = editValues[field as keyof typeof editValues]
      
      const updated = await updateClient(client.id, updateData)
      setClient(updated)
      setEditingField(null)
      toast({
        title: 'Success',
        description: 'Field updated',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update field',
        variant: 'destructive',
      })
    }
  }

  function cancelEditing() {
    setEditingField(null)
  }


  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'meeting':
        return <Calendar className="h-4 w-4" />
      default:
        return <Calendar className="h-4 w-4" />
    }
  }

  // Memoized view-models so we don't re-run formatting + icon selection on every re-render.
  const timelineInteractions = useMemo(() => {
    return interactions.map((interaction) => ({
      ...interaction,
      icon: getInteractionIcon(interaction.type),
      displayDate: format(new Date(interaction.date), 'MMM d, yyyy HH:mm'),
    }))
  }, [interactions])

  const noteCards = useMemo(() => {
    return notes.map((note) => ({
      ...note,
      displayDate: format(new Date(note.created_at), 'MMM d, yyyy HH:mm'),
    }))
  }, [notes])

  const reminderCards = useMemo(() => {
    return reminders.map((reminder) => ({
      ...reminder,
      displayDue: format(new Date(reminder.due_at), 'MMM d, yyyy HH:mm'),
    }))
  }, [reminders])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {editingField === 'name' ? (
            <div className="flex items-center gap-2">
              <Input
                value={editValues.name}
                onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                className="text-3xl font-bold"
                autoFocus
              />
              <Button size="sm" onClick={() => saveField('name')}>Save</Button>
              <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
            </div>
          ) : (
            <h1 
              className="text-3xl font-bold cursor-pointer hover:underline"
              onClick={() => startEditing('name')}
            >
              {client.name}
            </h1>
          )}
          {editingField === 'company' ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={editValues.company}
                onChange={(e) => setEditValues({ ...editValues, company: e.target.value })}
                placeholder="Company"
                autoFocus
              />
              <Button size="sm" onClick={() => saveField('company')}>Save</Button>
              <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
            </div>
          ) : (
            <p 
              className="mt-1 text-lg text-muted-foreground cursor-pointer hover:underline"
              onClick={() => startEditing('company')}
            >
              {client.company || 'Click to add company'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 self-start sm:gap-2 sm:self-center">
          {editingType ? (
            <Select
              value={client.client_type || 'presales'}
              onChange={(e) => handleTypeChange(e.target.value as ClientType)}
              onBlur={() => setEditingType(false)}
              className="w-28 text-xs sm:w-32 sm:text-sm"
              autoFocus
            >
              <option value="presales">Presales</option>
              <option value="customer">Customer</option>
            </Select>
          ) : (
            <Badge
              className={`inline-flex h-7 max-w-[5.5rem] shrink-0 items-center justify-center overflow-hidden px-2 py-0 text-[11px] font-medium leading-none sm:h-9 sm:max-w-none sm:px-4 sm:text-sm sm:font-normal sm:leading-normal cursor-pointer hover:opacity-80 ${
                client.client_type === 'presales'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setEditingStatus(false)
                setEditingType(true)
              }}
              title="Click to change client type"
            >
              <span className="truncate">{client.client_type === 'customer' ? 'Customer' : 'Presales'}</span>
            </Badge>
          )}
          {editingStatus ? (
            <div className="flex flex-col space-y-1 max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:gap-2 max-sm:space-y-0">
              <Select
                value={client.status}
                onChange={(e) => handleStatusChange(e.target.value as ClientStatus)}
                className="w-56 max-sm:min-w-0 max-sm:flex-1 max-sm:max-w-[min(100%,14rem)] sm:w-56"
              >
                {getStatusesForType(client.client_type, customStatuses).map((status) => (
                  <option key={status} value={status} title={STATUS_DESCRIPTIONS[status as keyof typeof STATUS_DESCRIPTIONS] || ''}>
                    {formatStatus(status, customStatuses)}
                  </option>
                ))}
              </Select>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {STATUS_DESCRIPTIONS[client.status as keyof typeof STATUS_DESCRIPTIONS] || 'Custom status'}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="group relative min-w-0 max-w-[9.5rem] sm:max-w-none">
                {(() => {
                  const badgeProps = getClientStatusBadgeProps(client.status, client.client_type, customStatuses)
                  return (
                    <Badge
                      className={`inline-flex h-7 min-w-0 max-w-full items-center overflow-hidden px-2 py-0 text-[11px] font-medium leading-tight sm:h-9 sm:px-4 sm:text-sm sm:font-normal sm:leading-normal ${badgeProps.className}`}
                      style={badgeProps.style}
                      title={
                        (STATUS_DESCRIPTIONS[client.status as keyof typeof STATUS_DESCRIPTIONS] || 'Custom status') +
                        ' — ' +
                        formatStatus(client.status, customStatuses)
                      }
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setEditingType(false)
                        setEditingStatus(true)
                      }}
                    >
                      <span className="truncate">{formatStatus(client.status, customStatuses)}</span>
                    </Badge>
                  )
                })()}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border whitespace-nowrap">
                    {STATUS_DESCRIPTIONS[client.status as keyof typeof STATUS_DESCRIPTIONS] || 'Custom status'}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 sm:h-9 sm:w-9"
                onClick={() => {
                  setEditingType(false)
                  setEditingStatus(true)
                }}
                title="Edit status"
              >
                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-2xl">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground max-sm:mb-0 max-sm:text-xs">Email</p>
                {editingField === 'email' ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      value={editValues.email}
                      onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => saveField('email')}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p
                      className="text-sm cursor-pointer hover:underline flex-1 min-w-0 truncate"
                      onClick={() => startEditing('email')}
                    >
                      {client.email || 'Click to add email'}
                    </p>
                    {client.email && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(client.email!).then(() => {
                            toast({ title: 'Copied', description: 'Email copied to clipboard' })
                          })
                        }}
                        title="Copy email"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground max-sm:mb-0 max-sm:text-xs">Phone</p>
                {editingField === 'phone' ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="tel"
                      value={editValues.phone}
                      onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => saveField('phone')}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p
                      className="text-sm cursor-pointer hover:underline flex-1 min-w-0 truncate"
                      onClick={() => startEditing('phone')}
                    >
                      {client.phone || 'Click to add phone'}
                    </p>
                    {client.phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(client.phone!).then(() => {
                            toast({ title: 'Copied', description: 'Phone copied to clipboard' })
                          })
                        }}
                        title="Copy phone"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground max-sm:mb-0 max-sm:text-xs">Source</p>
                {editingField === 'source' ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={sourceEditMode === 'custom' ? CUSTOM_SOURCE_VALUE : editValues.source}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === CUSTOM_SOURCE_VALUE) {
                            setSourceEditMode('custom')
                            setEditValues({ ...editValues, source: '' })
                          } else {
                            setSourceEditMode('preset')
                            setEditValues({ ...editValues, source: value })
                          }
                        }}
                        autoFocus
                        className="min-w-[200px]"
                      >
                        <option value="">Select source</option>
                        {SOURCE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value={CUSTOM_SOURCE_VALUE}>Custom...</option>
                      </Select>
                      <Button size="sm" onClick={() => saveField('source')}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
                    </div>
                    {sourceEditMode === 'custom' && (
                      <Input
                        value={editValues.source}
                        onChange={(e) => setEditValues({ ...editValues, source: e.target.value })}
                        placeholder="Custom source"
                      />
                    )}
                  </div>
                ) : (
                  <p 
                    className="text-sm cursor-pointer hover:underline"
                    onClick={() => startEditing('source')}
                  >
                    {client.source || 'Click to add source'}
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground max-sm:mb-0 max-sm:text-xs">Summary</p>
                {editingField === 'notes_summary' ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editValues.notes_summary}
                      onChange={(e) => setEditValues({ ...editValues, notes_summary: e.target.value })}
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveField('notes_summary')}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p 
                    className="text-sm cursor-pointer hover:underline whitespace-pre-wrap"
                    onClick={() => startEditing('notes_summary')}
                  >
                    {client.notes_summary || 'Click to add summary'}
                  </p>
                )}
              </div>
              <div className="border-t pt-2 max-sm:pt-1.5 sm:pt-2">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground max-sm:mb-1 sm:mb-2">Accounting Link</h3>
                {linkedAccountingCustomers.length > 0 ? (
                  <div className="space-y-2">
                    {linkedAccountingCustomers.map((customer) => (
                      <div key={customer.id} className="flex items-center justify-between">
                        <Link 
                          href={`/accounting/customers/${customer.id}`}
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <LinkIcon className="h-3 w-3" />
                          {customer.name}
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              const { linkAccountingCustomerToClient } = await import('@/app/actions/accounting-customers')
                              await linkAccountingCustomerToClient(customer.id, null)
                              toast({
                                title: 'Success',
                                description: 'Unlinked from accounting customer',
                              })
                              // Reload the page to refresh the list
                              window.location.reload()
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: error instanceof Error ? error.message : 'Failed to unlink',
                                variant: 'destructive',
                              })
                            }
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <LinkAccountingCustomerDialog 
                    clientId={client.id}
                    currentAccountingCustomerId={null}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 min-w-0">
          <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 overflow-x-auto overflow-y-hidden -mx-1 px-1 md:mx-0 md:px-0 [scrollbar-width:thin]">
                <TabsList className="flex flex-nowrap w-max">
                  <TabsTrigger value="timeline" className="shrink-0">Timeline</TabsTrigger>
                  <TabsTrigger value="notes" className="shrink-0">Notes</TabsTrigger>
                  <TabsTrigger value="offers" className="shrink-0">Offers</TabsTrigger>
                  <TabsTrigger value="reminders" className="shrink-0">Reminders</TabsTrigger>
                </TabsList>
              </div>
              <div
                className={cn(
                  'flex w-full flex-wrap items-center gap-2',
                  (detailTab === 'offers' || detailTab === 'reminders') &&
                    'max-sm:flex-nowrap max-sm:gap-2'
                )}
              >
                <Link
                  href={`/emails/compose?client_id=${client.id}`}
                  className={cn(
                    (detailTab === 'offers' || detailTab === 'reminders') && 'max-sm:min-w-0 max-sm:flex-1'
                  )}
                >
                  <Button
                    variant="outline"
                    className={cn(
                      'min-h-[40px] sm:w-auto',
                      (detailTab === 'offers' || detailTab === 'reminders') && 'w-full max-sm:w-full'
                    )}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </Button>
                </Link>
                {detailTab === 'offers' && (
                  <Link
                    href={`/offers/new?client_id=${client.id}`}
                    className="max-sm:min-w-0 max-sm:flex-1 sm:hidden"
                  >
                    <Button size="sm" className="min-h-[40px] w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      New Offer
                    </Button>
                  </Link>
                )}
                {detailTab === 'reminders' && (
                  <Button
                    type="button"
                    onClick={() => setShowReminderDialog(true)}
                    className="min-h-[40px] w-full max-sm:flex-1 sm:hidden"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Reminder
                  </Button>
                )}
                {detailTab !== 'notes' && (
                  <Button
                    onClick={() => setShowInteractionDialog(true)}
                    className={cn(
                      'min-h-[40px]',
                      (detailTab === 'offers' || detailTab === 'reminders') && 'max-sm:hidden'
                    )}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Interaction
                  </Button>
                )}
                {detailTab === 'notes' && (
                  <Button onClick={() => setShowNoteDialog(true)} className="min-h-[40px]">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Note
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="timeline" className="space-y-4">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : timelineInteractions.length > 0 ? (
                <div className="space-y-4">
                  {timelineInteractions.map((interaction) => (
                    <Card key={interaction.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {interaction.icon}
                              <span className="font-medium capitalize">
                                {interaction.type}
                              </span>
                              {interaction.direction && (
                                <Badge variant="outline" className="text-xs">
                                  {interaction.direction}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="mt-1 font-semibold">{interaction.subject}</p>
                              {interaction.email_id && (
                                <Link href={`/emails/${interaction.email_id}`}>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                                    View Email
                                  </Button>
                                </Link>
                              )}
                            </div>
                            {interaction.notes && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {interaction.notes}
                              </p>
                            )}
                            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                              <span>
                                {interaction.displayDate}
                              </span>
                              {interaction.duration_minutes && (
                                <span>{interaction.duration_minutes} min</span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              if (confirm('Delete this interaction?')) {
                                try {
                                  await deleteInteraction(interaction.id, client.id)
                                  setInteractions((prev) => {
                                    const next = prev.filter((i) => i.id !== interaction.id)
                                    syncClientDetailCacheForInteractions(next)
                                    return next
                                  })
                                  toast({
                                    title: 'Success',
                                    description: 'Interaction deleted',
                                  })
                                } catch (error) {
                                  toast({
                                    title: 'Error',
                                    description: 'Failed to delete interaction',
                                    variant: 'destructive',
                                  })
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No interactions yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : noteCards.length > 0 ? (
                <div className="space-y-4">
                  {noteCards.map((note) => (
                    <Card key={note.id} className={note.pinned ? 'border-primary' : ''}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
                          <div className="min-w-0 flex-1">
                            {note.pinned && (
                              <Badge variant="outline" className="mb-2">
                                Pinned
                              </Badge>
                            )}
                            {editingNoteId === note.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingNoteContent}
                                  onChange={(e) => setEditingNoteContent(e.target.value)}
                                  rows={4}
                                  className="min-h-[80px]"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await updateNote(note.id, client.id, editingNoteContent)
                                        setNotes((prev) =>
                                          prev.map((n) =>
                                            n.id === note.id ? { ...n, content: editingNoteContent } : n
                                          )
                                        )
                                        setEditingNoteId(null)
                                        setEditingNoteContent('')
                                        toast({ title: 'Success', description: 'Note updated' })
                                      } catch (error) {
                                        toast({
                                          title: 'Error',
                                          description: 'Failed to update note',
                                          variant: 'destructive',
                                        })
                                      }
                                    }}
                                  >
                                    <Check className="h-4 w-4 mr-1" /> Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingNoteId(null)
                                      setEditingNoteContent('')
                                    }}
                                  >
                                    <X className="h-4 w-4 mr-1" /> Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="break-words whitespace-pre-wrap">{note.content}</p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {note.displayDate}
                                </p>
                              </>
                            )}
                          </div>
                          {editingNoteId !== note.id && (
                            <div className="flex shrink-0 justify-end gap-2 sm:justify-start">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingNoteId(note.id)
                                  setEditingNoteContent(note.content)
                                }}
                                title="Edit note"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  try {
                                    await toggleNotePin(note.id, client.id, !note.pinned)
                                    setNotes((prev) =>
                                      prev.map((n) =>
                                        n.id === note.id ? { ...n, pinned: !n.pinned } : n
                                      )
                                    )
                                  } catch (error) {
                                    toast({
                                      title: 'Error',
                                      description: 'Failed to toggle pin',
                                      variant: 'destructive',
                                    })
                                  }
                                }}
                              >
                                {note.pinned ? (
                                  <PinOff className="h-4 w-4" />
                                ) : (
                                  <Pin className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  if (confirm('Delete this note?')) {
                                    try {
                                      await deleteNote(note.id, client.id)
                                      setNotes((prev) => prev.filter((n) => n.id !== note.id))
                                      if (editingNoteId === note.id) {
                                        setEditingNoteId(null)
                                        setEditingNoteContent('')
                                      }
                                      toast({
                                        title: 'Success',
                                        description: 'Note deleted',
                                      })
                                    } catch (error) {
                                      toast({
                                        title: 'Error',
                                        description: 'Failed to delete note',
                                        variant: 'destructive',
                                      })
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No notes yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="offers" className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">Offers</h3>
                <Link href={`/offers/new?client_id=${client.id}`} className="max-sm:hidden">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Offer
                  </Button>
                </Link>
              </div>
              {loading && offers.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Loading...</p>
                  </CardContent>
                </Card>
              ) : offers.length > 0 ? (
                <div className="space-y-4">
                  {offers.map((offer) => (
                    <Card key={offer.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Link href={`/offers/${offer.id}`} className="font-semibold hover:underline">
                                {offer.title}
                              </Link>
                              <Badge className={getStatusColor(offer.status as any, null)}>
                                {offer.status}
                              </Badge>
                            </div>
                            {offer.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {offer.description}
                              </p>
                            )}
                            <div className="mt-2 flex gap-4 text-sm">
                              <span className="font-semibold">
                                {offer.amount} {offer.currency}
                              </span>
                              {offer.valid_until && (
                                <span className="text-muted-foreground">
                                  Valid until: {format(new Date(offer.valid_until), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                          <Link href={`/offers/${offer.id}`}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No offers yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="reminders" className="space-y-4">
              <div className="flex justify-end max-sm:hidden">
                <Button onClick={() => setShowReminderDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Reminder
                </Button>
              </div>

              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : reminderCards.length > 0 ? (
                <div className="space-y-4">
                  {reminderCards.map((reminder) => (
                    <Card
                      key={reminder.id}
                      className={reminder.done ? 'opacity-60' : ''}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{reminder.title}</h3>
                              {reminder.done && (
                                <Badge variant="outline">Done</Badge>
                              )}
                            </div>
                            {reminder.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {reminder.description}
                              </p>
                            )}
                            <p className="mt-2 text-xs text-muted-foreground">
                              Due: {reminder.displayDue}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {!reminder.done && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  try {
                                    await markReminderDone(reminder.id, client.id)
                                    setReminders((prev) => {
                                      const next = prev.map((r) =>
                                        r.id === reminder.id ? { ...r, done: true } : r
                                      )
                                      syncClientDetailCacheForReminders(next)
                                      return next
                                    })
                                    toast({
                                      title: 'Success',
                                      description: 'Reminder marked as done',
                                    })
                                  } catch (error) {
                                    toast({
                                      title: 'Error',
                                      description: 'Failed to mark reminder',
                                      variant: 'destructive',
                                    })
                                  }
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {!reminder.done && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingReminder(reminder as unknown as Reminder)
                                  setShowReminderEditDialog(true)
                                }}
                                title="Edit reminder"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (confirm('Delete this reminder?')) {
                                  try {
                                    await deleteReminder(reminder.id, client.id)
                                    setReminders((prev) => {
                                      const next = prev.filter((r) => r.id !== reminder.id)
                                      syncClientDetailCacheForReminders(next)
                                      return next
                                    })
                                    toast({
                                      title: 'Success',
                                      description: 'Reminder deleted',
                                    })
                                  } catch (error) {
                                    toast({
                                      title: 'Error',
                                      description: 'Failed to delete reminder',
                                      variant: 'destructive',
                                    })
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No reminders yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Interaction Dialog */}
      <Dialog open={showInteractionDialog} onOpenChange={setShowInteractionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Interaction</DialogTitle>
            <DialogClose onClose={() => setShowInteractionDialog(false)} />
          </DialogHeader>
          <InteractionForm
            clientId={client.id}
            onSuccess={(created) => {
              setShowInteractionDialog(false)
              setInteractions((prev) => {
                const next = [created, ...prev].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                )
                syncClientDetailCacheForInteractions(next)
                return next
              })
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Reminder</DialogTitle>
            <DialogClose onClose={() => setShowReminderDialog(false)} />
          </DialogHeader>
          <ReminderForm
            clientId={client.id}
            onSuccess={() => {
              setShowReminderDialog(false)
              loadData({ forceNetwork: true })
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Reminder Edit Dialog (pending reminders only) */}
      <Dialog
        open={showReminderEditDialog}
        onOpenChange={(open) => {
          setShowReminderEditDialog(open)
          if (!open) setEditingReminder(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reminder</DialogTitle>
            <DialogClose onClose={() => setShowReminderEditDialog(false)} />
          </DialogHeader>
          {editingReminder && (
            <ReminderEditForm
              clientId={client.id}
              reminder={editingReminder}
              onUpdated={(updated) => {
                setShowReminderEditDialog(false)
                setEditingReminder(null)
                setReminders((prev) => {
                  const next = prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
                  syncClientDetailCacheForReminders(next)
                  return next
                })
                toast({ title: 'Success', description: 'Reminder updated successfully' })
              }}
              onCancel={() => {
                setShowReminderEditDialog(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogClose onClose={() => setShowNoteDialog(false)} />
          </DialogHeader>
          <NoteForm
            clientId={client.id}
            onSuccess={() => {
              setShowNoteDialog(false)
              loadData({ forceNetwork: true })
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function toLocalDateTimeLocalString(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function InteractionForm({
  clientId,
  onSuccess,
}: {
  clientId: string
  onSuccess: (created: Interaction) => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: 'call' as 'call' | 'email' | 'meeting' | 'other',
    direction: 'outbound' as 'inbound' | 'outbound' | '',
    date: toLocalDateTimeLocalString(new Date()),
    duration_minutes: '',
    subject: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const created = await createInteraction({
        client_id: clientId,
        type: formData.type,
        direction: formData.direction || undefined,
        // `datetime-local` is interpreted as "local time" by the browser; convert to ISO (with offset)
        // so the server doesn't shift it based on its own timezone.
        date: new Date(formData.date).toISOString(),
        duration_minutes: formData.duration_minutes
          ? parseInt(formData.duration_minutes)
          : undefined,
        subject: formData.subject,
        notes: formData.notes || undefined,
      })

      toast({
        title: 'Success',
        description: 'Interaction created',
      })
      onSuccess(created)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create interaction',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <Select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as any })
            }
            disabled={loading}
          >
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Direction</label>
          <Select
            value={formData.direction}
            onChange={(e) =>
              setFormData({ ...formData, direction: e.target.value as any })
            }
            disabled={loading}
          >
            <option value="">None</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Date & Time</label>
          <Input
            type="datetime-local"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Duration (minutes)</label>
          <Input
            type="number"
            value={formData.duration_minutes}
            onChange={(e) =>
              setFormData({ ...formData, duration_minutes: e.target.value })
            }
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Subject (optional)</label>
        <Input
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          disabled={loading}
          rows={4}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

function ReminderForm({
  clientId,
  onSuccess,
}: {
  clientId: string
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    title: '',
    description: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await createReminder({
        client_id: clientId,
        due_at: formData.due_at,
        title: formData.title,
        description: formData.description || undefined,
      })

      toast({
        title: 'Success',
        description: 'Reminder created',
      })
      onSuccess()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create reminder',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Due Date & Time</label>
        <Input
          type="datetime-local"
          value={formData.due_at}
          onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          disabled={loading}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

function ReminderEditForm({
  clientId,
  reminder,
  onUpdated,
  onCancel,
}: {
  clientId: string
  reminder: Reminder
  onUpdated: (updated: {
    id: string
    title: string
    due_at: string
    description: string | null
    done: boolean
  }) => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: reminder.title,
    due_at: toLocalDateTimeLocalString(new Date(reminder.due_at)),
    description: reminder.description ?? '',
  })

  useEffect(() => {
    setFormData({
      title: reminder.title,
      due_at: toLocalDateTimeLocalString(new Date(reminder.due_at)),
      description: reminder.description ?? '',
    })
  }, [reminder.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // Allow clearing description: empty string -> null (updateReminder does `value || null`)
      await updateReminder(reminder.id, clientId, {
        due_at: formData.due_at,
        title: formData.title,
        description: formData.description.trim(),
      })

      const nextDueIso = new Date(formData.due_at).toISOString()
      const nextDescription = formData.description.trim() ? formData.description.trim() : null

      onUpdated({
        id: reminder.id,
        title: formData.title,
        due_at: nextDueIso,
        description: nextDescription,
        done: reminder.done,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update reminder',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Title</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          disabled={loading}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Date & Time</label>
        <Input
          type="datetime-local"
          value={formData.due_at}
          onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
          required
          disabled={loading}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Note (optional)</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          disabled={loading}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onCancel()
          }}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update Reminder'}
        </Button>
      </div>
    </form>
  )
}

function NoteForm({
  clientId,
  onSuccess,
}: {
  clientId: string
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await createNote({
        client_id: clientId,
        content,
      })

      toast({
        title: 'Success',
        description: 'Note created',
      })
      onSuccess()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create note',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Content</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          disabled={loading}
          rows={6}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}



