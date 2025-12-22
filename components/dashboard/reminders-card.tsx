'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import Link from 'next/link'
import { Calendar, List, Plus } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns'
import { createReminder } from '@/app/actions/reminders'
import { useToast } from '@/components/ui/toaster'
import { useRouter } from 'next/navigation'

interface RemindersCardProps {
  reminders: any[]
  overdueReminders: any[]
  todayReminders: any[]
  upcomingReminders: any[]
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
  clients,
}: RemindersCardProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showQuickDialog, setShowQuickDialog] = useState(false)
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

  async function handleQuickCreate() {
    if (!quickFormData.client_id || !quickFormData.title) {
      toast({
        title: 'Error',
        description: 'Please select a client and enter a title',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await createReminder({
        client_id: quickFormData.client_id,
        due_at: quickFormData.due_at,
        title: quickFormData.title,
        description: quickFormData.description || undefined,
      })

      toast({
        title: 'Success',
        description: 'Reminder created successfully',
      })

      setShowQuickDialog(false)
      setQuickFormData({
        client_id: '',
        title: '',
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        description: '',
      })

      router.refresh()
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
    <Card>
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
              onClick={() => setShowQuickDialog(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Quick Add
            </Button>
            <div className="flex items-center gap-2 border rounded-md p-1 bg-muted">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-3"
            >
              <List className="h-4 w-4 mr-1.5" />
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="h-8 px-3"
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              Calendar
            </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {viewMode === 'list' && (
          <div>
            {overdueReminders.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-destructive">
                  Overdue
                </h3>
                <div className="space-y-2">
                  {overdueReminders.map((reminder: any) => (
                    <Link
                      key={reminder.id}
                      href={`/clients/${reminder.client_id}`}
                      className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{reminder.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {getClientName(reminder)}
                          </p>
                          <p className="text-xs text-destructive">
                            {formatDateTime(reminder.due_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {todayReminders.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Today</h3>
                <div className="space-y-2">
                  {todayReminders.map((reminder: any) => (
                    <Link
                      key={reminder.id}
                      href={`/clients/${reminder.client_id}`}
                      className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{reminder.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {getClientName(reminder)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(reminder.due_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {upcomingReminders.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Upcoming</h3>
                <div className="space-y-2">
                  {upcomingReminders.map((reminder: any) => (
                    <Link
                      key={reminder.id}
                      href={`/clients/${reminder.client_id}`}
                      className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{reminder.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {getClientName(reminder)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(reminder.due_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {reminders.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No upcoming reminders
              </p>
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
                    className={`min-h-[80px] border rounded-md p-1 ${
                      !isCurrentMonth ? 'opacity-40 bg-muted/30' : ''
                    } ${isToday ? 'ring-2 ring-primary' : ''} ${
                      isPast ? 'bg-muted/20' : ''
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayReminders.slice(0, 2).map((reminder: any) => {
                        const isOverdue = new Date(reminder.due_at) < new Date() && !isSameDay(new Date(reminder.due_at), new Date())
                        return (
                          <Link
                            key={reminder.id}
                            href={`/clients/${reminder.client_id}`}
                            className={`block text-xs p-1 rounded truncate transition-colors hover:opacity-80 ${
                              isOverdue
                                ? 'bg-destructive/20 text-destructive border border-destructive/30'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}
                            title={reminder.title}
                          >
                            {reminder.title}
                          </Link>
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

      <Dialog open={showQuickDialog} onOpenChange={setShowQuickDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Add Reminder</DialogTitle>
            <DialogDescription>
              Create a new reminder quickly
            </DialogDescription>
          </DialogHeader>
          <DialogClose onClose={() => setShowQuickDialog(false)} />

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Client</label>
              <Select
                value={quickFormData.client_id}
                onChange={(e) => setQuickFormData({ ...quickFormData, client_id: e.target.value })}
                required
                disabled={loading}
              >
                <option value="">Select a client</option>
                {clients.map((client: any) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `(${client.company})` : ''}
                  </option>
                ))}
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
                onClick={() => setShowQuickDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleQuickCreate}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Reminder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
