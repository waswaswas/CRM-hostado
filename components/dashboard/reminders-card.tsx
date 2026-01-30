'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import Link from 'next/link'
import { Calendar, List, Plus, Edit, Trash2, UserPlus, CheckSquare, CheckCircle2, ChevronRight } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns'
import { createReminder, updateReminder, deleteReminder, markReminderDone, unmarkReminderDone } from '@/app/actions/reminders'
import { useToast } from '@/components/ui/toaster'
import { useRouter } from 'next/navigation'

interface RemindersCardProps {
  reminders: any[]
  overdueReminders: any[]
  todayReminders: any[]
  upcomingReminders: any[]
  completedReminders: any[]
  clients: any[]
}

function formatDateTime(dateString: string) {
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm')
  } catch {
    return dateString
  }
}

function getClientName(reminder: any) {
  if (!reminder.client_id) {
    return 'General'
  }
  if (reminder.clients && typeof reminder.clients === 'object') {
    return reminder.clients.name || 'Client'
  }
  return 'Client'
}

export function RemindersCard({
  reminders,
  overdueReminders,
  todayReminders,
  upcomingReminders,
  completedReminders,
  clients,
}: RemindersCardProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'completed'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showQuickDialog, setShowQuickDialog] = useState(false)
  const [editingReminder, setEditingReminder] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [quickFormData, setQuickFormData] = useState({
    client_id: '',
    title: '',
    due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    description: '',
  })

  // Calendar view helpers
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getRemindersForDate = (date: Date) => {
    return reminders.filter((r: any) => {
      if (r.done) return false
      const reminderDate = new Date(r.due_at)
      return isSameDay(reminderDate, date)
    })
  }

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  function formatDateForInput(date: Date): string {
    // Format date in local timezone (YYYY-MM-DDTHH:mm)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  function openQuickDialog(date?: Date, reminder?: any) {
    if (reminder) {
      // Edit mode
      setEditingReminder(reminder)
      const reminderDate = new Date(reminder.due_at)
      setQuickFormData({
        client_id: reminder.client_id,
        title: reminder.title,
        due_at: formatDateForInput(reminderDate),
        description: reminder.description || '',
      })
    } else {
      // Create mode
      setEditingReminder(null)
      const defaultDate = date || new Date(Date.now() + 24 * 60 * 60 * 1000)
      // Set time to current time or 9 AM if clicking on a calendar day
      if (date) {
        const now = new Date()
        defaultDate.setHours(now.getHours(), now.getMinutes(), 0, 0)
      }
      setQuickFormData({
        client_id: '',
        title: '',
        due_at: formatDateForInput(defaultDate),
        description: '',
      })
    }
    setShowQuickDialog(true)
  }

  function closeQuickDialog() {
    setShowQuickDialog(false)
    setEditingReminder(null)
    setQuickFormData({
      client_id: '',
      title: '',
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      description: '',
    })
  }

  async function handleQuickCreate() {
    if (!quickFormData.title) {
      toast({
        title: 'Error',
        description: 'Please enter a title',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // For "General" reminders, pass null as client_id
      const clientId = quickFormData.client_id === 'general' ? null : quickFormData.client_id
      
      if (editingReminder) {
        // Update existing reminder
        await updateReminder(editingReminder.id, clientId || editingReminder.client_id, {
          due_at: quickFormData.due_at,
          title: quickFormData.title,
          description: quickFormData.description || undefined,
        })
        toast({
          title: 'Success',
          description: 'Reminder updated successfully',
        })
      } else {
        // Create new reminder
        await createReminder({
          client_id: clientId,
          due_at: quickFormData.due_at,
          title: quickFormData.title,
          description: quickFormData.description || undefined,
        })
        toast({
          title: 'Success',
          description: 'Reminder created successfully',
        })
      }

      closeQuickDialog()
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${editingReminder ? 'update' : 'create'} reminder`,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(reminder: any) {
    if (!confirm(`Are you sure you want to delete "${reminder.title}"?`)) {
      return
    }

    setLoading(true)
    try {
      await deleteReminder(reminder.id, reminder.client_id)
      toast({
        title: 'Success',
        description: 'Reminder deleted successfully',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete reminder',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleDone(reminder: any) {
    setLoading(true)
    try {
      if (reminder.done) {
        // Unmark as done
        await unmarkReminderDone(reminder.id, reminder.client_id || null)
        toast({
          title: 'Success',
          description: 'Reminder marked as not done',
        })
      } else {
        // Mark as done
        await markReminderDone(reminder.id, reminder.client_id || null)
        toast({
          title: 'Success',
          description: 'Reminder marked as done',
        })
      }
      router.refresh()
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

  // For list view on dashboard: show at most 4 reminders total (overdue, then today, then upcoming)
  let rem = 4
  const overdueDisplay = overdueReminders.slice(0, rem)
  rem -= overdueDisplay.length
  const todayDisplay = todayReminders.slice(0, rem)
  rem -= todayDisplay.length
  const upcomingDisplay = upcomingReminders.slice(0, rem)
  const hasMoreReminders = overdueReminders.length + todayReminders.length + upcomingReminders.length > 4

  return (
    <Card id="reminders">
      <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Reminders
            </CardTitle>
            <CardDescription>Upcoming and overdue reminders</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => openQuickDialog()}
              className="min-h-[44px] px-3 md:h-8"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Quick Add</span>
              <span className="sm:hidden">Add</span>
            </Button>
            <div className="flex items-center gap-2 border rounded-md p-1 bg-muted">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="min-h-[44px] px-3 md:h-8"
            >
              <List className="h-4 w-4 mr-1.5" />
              <span>List</span>
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="min-h-[44px] px-3 md:h-8"
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              <span>Calendar</span>
            </Button>
            <Button
              variant={viewMode === 'completed' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('completed')}
              className="h-8 px-3"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Completed
            </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {viewMode === 'list' && (
          <div className="space-y-5">
            {overdueDisplay.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive/90 px-1">
                  Overdue
                </h3>
                <div className="space-y-2">
                  {overdueDisplay.map((reminder: any) => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-3 rounded-xl border-l-4 border-l-destructive/80 bg-destructive/5 dark:bg-destructive/10 p-3.5 hover:bg-destructive/10 dark:hover:bg-destructive/15 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleDone(reminder)}
                        disabled={loading}
                        className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${reminder.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'}`}
                      >
                        {reminder.done && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                      <Link
                        href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'}
                        className="flex-1 min-w-0 transition-colors hover:text-primary"
                        onClick={(e) => !reminder.client_id && e.preventDefault()}
                      >
                        <p className="font-medium text-foreground truncate">{reminder.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{getClientName(reminder)}</p>
                        <p className="text-xs text-destructive font-medium mt-0.5">{formatDateTime(reminder.due_at)}</p>
                      </Link>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); openQuickDialog(undefined, reminder) }} disabled={loading} className="h-9 w-9 rounded-lg" aria-label="Edit"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleDelete(reminder) }} disabled={loading} className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {todayDisplay.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary px-1">
                  Today
                </h3>
                <div className="space-y-2">
                  {todayDisplay.map((reminder: any) => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-muted/40 dark:hover:bg-muted/30 transition-colors p-3.5 border-l-4 border-l-primary/60"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleDone(reminder)}
                        disabled={loading}
                        className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${reminder.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'}`}
                      >
                        {reminder.done && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                      <Link href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'} className="flex-1 min-w-0 hover:text-primary" onClick={(e) => !reminder.client_id && e.preventDefault()}>
                        <p className="font-medium text-foreground truncate">{reminder.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{getClientName(reminder)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(reminder.due_at)}</p>
                      </Link>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); openQuickDialog(undefined, reminder) }} disabled={loading} className="h-9 w-9 rounded-lg" aria-label="Edit"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleDelete(reminder) }} disabled={loading} className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {upcomingDisplay.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Upcoming
                </h3>
                <div className="space-y-2">
                  {upcomingDisplay.map((reminder: any) => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-muted/40 dark:hover:bg-muted/30 transition-colors p-3.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleDone(reminder)}
                        disabled={loading}
                        className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${reminder.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'}`}
                      >
                        {reminder.done && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                      <Link href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'} className="flex-1 min-w-0 hover:text-primary" onClick={(e) => !reminder.client_id && e.preventDefault()}>
                        <p className="font-medium text-foreground truncate">{reminder.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{getClientName(reminder)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(reminder.due_at)}</p>
                      </Link>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); openQuickDialog(undefined, reminder) }} disabled={loading} className="h-9 w-9 rounded-lg" aria-label="Edit"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleDelete(reminder) }} disabled={loading} className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {overdueDisplay.length === 0 && todayDisplay.length === 0 && upcomingDisplay.length === 0 && (
              <div className="py-10 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming reminders</p>
                <p className="text-xs text-muted-foreground mt-1">Use Quick Add to create one</p>
              </div>
            )}

            {hasMoreReminders && (
              <Link
                href="/dashboard#reminders"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/30 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-primary/30 transition-colors"
              >
                View all reminders
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}

        {viewMode === 'completed' && (
          <div className="space-y-2">
            {completedReminders.length > 0 ? (
              completedReminders.map((reminder: any) => (
                <div
                  key={reminder.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 dark:bg-muted/20 p-3.5"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleDone(reminder)}
                    disabled={loading}
                    className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${reminder.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'}`}
                  >
                    {reminder.done && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                  <Link href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'} className="flex-1 min-w-0 hover:text-primary" onClick={(e) => !reminder.client_id && e.preventDefault()}>
                    <p className="font-medium line-through text-muted-foreground truncate">{reminder.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{getClientName(reminder)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(reminder.due_at)}</p>
                  </Link>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); openQuickDialog(undefined, reminder) }} disabled={loading} className="h-9 w-9 rounded-lg" aria-label="Edit"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleDelete(reminder) }} disabled={loading} className="h-9 w-9 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No completed reminders</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'calendar' && (
          <div className="space-y-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                ← Prev
              </Button>
              <h3 className="text-lg font-semibold">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                Next →
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {calendarDays.map((day, idx) => {
                const dayReminders = getRemindersForDate(day)
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isToday = isSameDay(day, new Date())
                const isPast = day < new Date() && !isToday

                return (
                  <div
                    key={idx}
                    className={`min-h-[80px] border rounded-md p-1 cursor-pointer transition-colors ${
                      !isCurrentMonth ? 'opacity-40 bg-muted/30' : ''
                    } ${isToday ? 'ring-2 ring-primary' : ''} ${
                      isPast ? 'bg-muted/20' : ''
                    } hover:bg-accent/50`}
                    onClick={() => openQuickDialog(day)}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                      {dayReminders.slice(0, 2).map((reminder: any) => {
                        const isOverdue = new Date(reminder.due_at) < new Date() && !isSameDay(new Date(reminder.due_at), new Date())
                        return (
                          <div
                            key={reminder.id}
                            className={`group relative text-xs p-1 rounded truncate transition-colors ${
                              isOverdue
                                ? 'bg-destructive/20 text-destructive border border-destructive/30'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            } hover:opacity-80`}
                          >
                            <Link
                              href={reminder.client_id ? `/clients/${reminder.client_id}` : '#'}
                              className={`block truncate ${!reminder.client_id ? 'cursor-default' : ''}`}
                              title={reminder.title}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!reminder.client_id) {
                                  e.preventDefault()
                                }
                              }}
                            >
                              {reminder.title}
                            </Link>
                            <div className="absolute right-0 top-0 hidden group-hover:flex gap-0.5 bg-background/90 rounded shadow-sm">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  openQuickDialog(undefined, reminder)
                                }}
                                className="h-5 w-5 p-0"
                                disabled={loading}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDelete(reminder)
                                }}
                                className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                disabled={loading}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                      {dayReminders.length > 2 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayReminders.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={showQuickDialog} onOpenChange={closeQuickDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReminder ? 'Edit Reminder' : 'Quick Add Reminder'}</DialogTitle>
            <DialogDescription>
              {editingReminder ? 'Update reminder details' : 'Create a new reminder quickly'}
            </DialogDescription>
          </DialogHeader>
          <DialogClose onClose={closeQuickDialog} />

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Client</label>
              <Select
                value={quickFormData.client_id}
                onChange={(e) => {
                  if (e.target.value === 'add_new') {
                    // Navigate to new client page
                    router.push('/clients/new')
                    closeQuickDialog()
                  } else {
                    setQuickFormData({ ...quickFormData, client_id: e.target.value })
                  }
                }}
                disabled={loading}
              >
                <option value="">Select a client</option>
                <option value="general">General</option>
                {clients.map((client: any) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `(${client.company})` : ''}
                  </option>
                ))}
                <option value="add_new" className="text-primary font-medium">
                  + Add a customer
                </option>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input
                value={quickFormData.title}
                onChange={(e) => setQuickFormData({ ...quickFormData, title: e.target.value })}
                placeholder="Reminder title"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Date & Time</label>
              <Input
                type="datetime-local"
                value={quickFormData.due_at}
                onChange={(e) => setQuickFormData({ ...quickFormData, due_at: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Note (optional)</label>
              <Textarea
                value={quickFormData.description}
                onChange={(e) => setQuickFormData({ ...quickFormData, description: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={closeQuickDialog}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleQuickCreate}
                disabled={loading}
              >
                {loading 
                  ? (editingReminder ? 'Updating...' : 'Creating...') 
                  : (editingReminder ? 'Update Reminder' : 'Create Reminder')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
























