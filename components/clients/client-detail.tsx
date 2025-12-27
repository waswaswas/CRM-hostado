'use client'

import { useState, useEffect } from 'react'
import { Client, Interaction, Reminder, ClientNote, ClientStatus, Offer } from '@/types/database'
import { getStatusesForType, getStatusColor, formatStatus, STATUS_DESCRIPTIONS } from '@/lib/status-utils'
import { getSettings } from '@/app/actions/settings'
import type { StatusConfig } from '@/types/settings'
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
  deleteReminder,
} from '@/app/actions/reminders'
import { getNotesForClient, createNote, toggleNotePin, deleteNote } from '@/app/actions/notes'
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
} from 'lucide-react'

interface ClientDetailProps {
  client: Client
}

export function ClientDetail({ client: initialClient }: ClientDetailProps) {
  const { toast } = useToast()
  const [client, setClient] = useState(initialClient)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [showInteractionDialog, setShowInteractionDialog] = useState(false)
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: '',
    notes_summary: '',
  })
  const [customStatuses, setCustomStatuses] = useState<StatusConfig[]>([])

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

  useEffect(() => {
    loadData()
  }, [client.id])

  async function loadData() {
    setLoading(true)
    try {
      const [interactionsData, remindersData, notesData, offersData] = await Promise.allSettled([
        getInteractionsForClient(client.id),
        getRemindersForClient(client.id),
        getNotesForClient(client.id),
        getOffersForClient(client.id),
      ])
      
      if (interactionsData.status === 'fulfilled') {
        setInteractions(interactionsData.value)
      } else {
        console.error('Failed to load interactions:', interactionsData.reason)
        setInteractions([])
      }
      
      if (remindersData.status === 'fulfilled') {
        setReminders(remindersData.value)
      } else {
        console.error('Failed to load reminders:', remindersData.reason)
        setReminders([])
      }
      
      if (notesData.status === 'fulfilled') {
        setNotes(notesData.value)
      } else {
        console.error('Failed to load notes:', notesData.reason)
        setNotes([])
      }
      
      if (offersData.status === 'fulfilled') {
        setOffers(offersData.value)
      } else {
        console.error('Failed to load offers:', offersData.reason)
        setOffers([])
      }
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
        <div className="flex items-center gap-2">
          {editingStatus ? (
            <div className="space-y-1">
              <Select
                value={client.status}
                onChange={(e) => handleStatusChange(e.target.value as ClientStatus)}
                className="w-56"
              >
                {getStatusesForType(client.client_type, customStatuses).map((status) => (
                  <option key={status} value={status} title={STATUS_DESCRIPTIONS[status as keyof typeof STATUS_DESCRIPTIONS] || ''}>
                    {formatStatus(status, customStatuses)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                {STATUS_DESCRIPTIONS[client.status as keyof typeof STATUS_DESCRIPTIONS] || 'Custom status'}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="group relative">
                <Badge 
                  className={getStatusColor(client.status, client.client_type)}
                  title={STATUS_DESCRIPTIONS[client.status as keyof typeof STATUS_DESCRIPTIONS] || 'Custom status'}
                >
                  {formatStatus(client.status, customStatuses)}
                </Badge>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-md border whitespace-nowrap">
                    {STATUS_DESCRIPTIONS[client.status as keyof typeof STATUS_DESCRIPTIONS] || 'Custom status'}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingStatus(true)}
                title="Edit status"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Email</p>
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
                  <p 
                    className="text-sm cursor-pointer hover:underline"
                    onClick={() => startEditing('email')}
                  >
                    {client.email || 'Click to add email'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Phone</p>
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
                  <p 
                    className="text-sm cursor-pointer hover:underline"
                    onClick={() => startEditing('phone')}
                  >
                    {client.phone || 'Click to add phone'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Source</p>
                {editingField === 'source' ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editValues.source}
                      onChange={(e) => setEditValues({ ...editValues, source: e.target.value })}
                      placeholder="Source"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => saveField('source')}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
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
                <p className="text-sm font-medium text-muted-foreground mb-1">Summary</p>
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
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="offers">Offers</TabsTrigger>
              <TabsTrigger value="reminders">Reminders</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
              <div className="flex justify-end gap-2">
                <Link href={`/emails/compose?client_id=${client.id}`}>
                  <Button variant="outline">
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </Button>
                </Link>
                <Button onClick={() => setShowInteractionDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Interaction
                </Button>
              </div>

              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : interactions.length > 0 ? (
                <div className="space-y-4">
                  {interactions.map((interaction) => (
                    <Card key={interaction.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {getInteractionIcon(interaction.type)}
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
                                {format(new Date(interaction.date), 'MMM d, yyyy HH:mm')}
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
                                  setInteractions((prev) =>
                                    prev.filter((i) => i.id !== interaction.id)
                                  )
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
              <div className="flex justify-end">
                <Button onClick={() => setShowNoteDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Note
                </Button>
              </div>

              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <Card key={note.id} className={note.pinned ? 'border-primary' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {note.pinned && (
                              <Badge variant="outline" className="mb-2">
                                Pinned
                              </Badge>
                            )}
                            <p className="whitespace-pre-wrap">{note.content}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                            </p>
                          </div>
                          <div className="flex gap-2">
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
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Offers</h3>
                <Link href={`/offers/new?client_id=${client.id}`}>
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
              <div className="flex justify-end">
                <Button onClick={() => setShowReminderDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Reminder
                </Button>
              </div>

              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : reminders.length > 0 ? (
                <div className="space-y-4">
                  {reminders.map((reminder) => (
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
                              Due: {format(new Date(reminder.due_at), 'MMM d, yyyy HH:mm')}
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
                                    setReminders((prev) =>
                                      prev.map((r) =>
                                        r.id === reminder.id ? { ...r, done: true } : r
                                      )
                                    )
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (confirm('Delete this reminder?')) {
                                  try {
                                    await deleteReminder(reminder.id, client.id)
                                    setReminders((prev) =>
                                      prev.filter((r) => r.id !== reminder.id)
                                    )
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
            onSuccess={() => {
              setShowInteractionDialog(false)
              loadData()
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
              loadData()
            }}
          />
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
              loadData()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InteractionForm({
  clientId,
  onSuccess,
}: {
  clientId: string
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: 'call' as 'call' | 'email' | 'meeting' | 'other',
    direction: 'outbound' as 'inbound' | 'outbound' | '',
    date: new Date().toISOString().slice(0, 16),
    duration_minutes: '',
    subject: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await createInteraction({
        client_id: clientId,
        type: formData.type,
        direction: formData.direction || undefined,
        date: formData.date,
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
      onSuccess()
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
        <label className="text-sm font-medium">Subject</label>
        <Input
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          required
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



