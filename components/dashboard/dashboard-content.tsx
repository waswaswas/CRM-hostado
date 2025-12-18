'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Calendar, Users, Plus, AlertCircle, TrendingUp, Clock, Tag } from 'lucide-react'
import { format, parseISO } from 'date-fns'
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
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t.dashboard.upcomingReminders}
            </CardTitle>
            <CardDescription>{t.dashboard.upcomingReminders}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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






