'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Link from 'next/link'
import { Calendar, Users, Plus, AlertCircle, TrendingUp, Clock, Tag, List } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns'
import { useI18n } from '@/lib/i18n/context'

function formatDateTime(dateString: string) {
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm')
  } catch {
    return dateString
  }
}

interface DashboardContentProps {
  reminders: any[]
  clients: any[]
  stats: {
    newLeadsWeek: number
    newLeadsMonth: number
    newTagLeads: number
    waitingForOffer: number
  }
  dbError: string | null
}

export function DashboardContent({ reminders, clients, stats, dbError }: DashboardContentProps) {
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const recentClients = clients.slice(0, 5)

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const overdueReminders = reminders.filter((r: any) => {
    const dueDate = new Date(r.due_at)
    return dueDate < today && !r.done
  })

  const todayReminders = reminders.filter((r: any) => {
    const dueDate = new Date(r.due_at)
    dueDate.setHours(0, 0, 0, 0)
    return dueDate.getTime() === today.getTime() && !r.done
  })

  const upcomingReminders = reminders.filter((r: any) => {
    const dueDate = new Date(r.due_at)
    return dueDate >= tomorrow && !r.done
  }).slice(0, 5)

  const getClientName = (reminder: any) => {
    if (reminder.clients && typeof reminder.clients === 'object') {
      return reminder.clients.name || 'Client'
    }
    return 'Client'
  }

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

  return (
    <div className="space-y-6">
      {dbError && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-1">Database Setup Required</h3>
                <p className="text-sm text-yellow-800 mb-3">{dbError}</p>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-2">To fix this:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Go to your Supabase Dashboard</li>
                    <li>Open the SQL Editor</li>
                    <li>Copy and paste the contents of <code className="bg-yellow-100 px-1 rounded">supabase/schema.sql</code></li>
                    <li>Click "Run" to execute the SQL</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t.dashboard.title}</h1>
        <Link href="/clients/new">
          <Button size="lg" className="h-12 w-12 rounded-full p-0">
            <Plus className="h-6 w-6" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t.dashboard.upcomingReminders}
                </CardTitle>
                <CardDescription>{t.dashboard.upcomingReminders}</CardDescription>
              </div>
              <div className="flex items-center gap-2 border rounded-md p-1 bg-muted w-fit">
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
          </CardHeader>
          <CardContent className="space-y-4">
            {viewMode === 'list' && (
              <div>
            {overdueReminders.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-destructive">
                  {t.dashboard.overdue}
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
                <h3 className="mb-2 text-sm font-semibold">{t.dashboard.today}</h3>
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
                <h3 className="mb-2 text-sm font-semibold">{t.dashboard.tomorrow}</h3>
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
              <p className="text-sm text-muted-foreground">{t.dashboard.noReminders}</p>
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
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t.dashboard.recentClients}
            </CardTitle>
            <CardDescription>{t.dashboard.recentClients}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentClients.length > 0 ? (
              <div className="space-y-2">
                {recentClients.map((client: any) => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <p className="font-medium">{client.name}</p>
                    {client.company && (
                      <p className="text-sm text-muted-foreground">{client.company}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(client.created_at)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t.dashboard.noClients}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.dashboard.newLeadsWeek}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.newLeadsWeek}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.dashboard.newLeadsMonth}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.newLeadsMonth}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.dashboard.newTagLeads}</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.newTagLeads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.dashboard.waitingForOffer}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.waitingForOffer}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}























