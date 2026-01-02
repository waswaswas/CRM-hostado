import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getUpcomingReminders, getCompletedReminders } from '@/app/actions/reminders'
import { getClients } from '@/app/actions/clients'
import { getDashboardStats } from '@/app/actions/stats'
import { getSettings } from '@/app/actions/settings'
import { formatStatus, getStatusColor } from '@/lib/status-utils'
import Link from 'next/link'
import { Calendar, Users, Plus, AlertCircle, TrendingUp, Clock, Tag, List } from 'lucide-react'
import { RemindersCard } from '@/components/dashboard/reminders-card'
import { format, parseISO } from 'date-fns'

function formatDateTime(dateString: string) {
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm')
  } catch {
    return dateString
  }
}

export default async function DashboardPage() {
  let reminders = []
  let clients = []
  let stats = { newLeadsWeek: 0, newLeadsMonth: 0, newTagLeads: 0, waitingForOffer: 0 }
  let dbError = null
  let customStatuses: Array<{ key: string; label: string }> = []

  let completedReminders = []
  
  try {
    reminders = await getUpcomingReminders()
    completedReminders = await getCompletedReminders()
    clients = await getClients()
  } catch (error) {
    dbError = error instanceof Error ? error.message : 'Database error'
  }

  try {
    stats = await getDashboardStats()
  } catch (error) {
    // Stats are optional, don't break the page if they fail
    console.error('Failed to load dashboard stats:', error)
    stats = { newLeadsWeek: 0, newLeadsMonth: 0, newTagLeads: 0, waitingForOffer: 0 }
  }

  try {
    const settings = await getSettings()
    customStatuses = settings.custom_statuses || []
  } catch (error) {
    // Settings are optional, continue without custom statuses
    console.warn('Failed to load settings:', error)
  }

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
    <AppLayout>
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
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Link href="/clients/new">
            <Button size="lg" className="h-12 w-12 rounded-full p-0">
              <Plus className="h-6 w-6" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <RemindersCard 
            reminders={reminders}
            overdueReminders={overdueReminders}
            todayReminders={todayReminders}
            upcomingReminders={upcomingReminders}
            completedReminders={completedReminders}
            clients={clients}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recent Clients
              </CardTitle>
              <CardDescription>Recently added clients</CardDescription>
            </CardHeader>
            <CardContent>
              {recentClients.length > 0 ? (
                <div className="space-y-2">
                  {recentClients.map((client) => (
                    <Link
                      key={client.id}
                      href={`/clients/${client.id}`}
                      className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{client.name}</p>
                          {client.company && (
                            <p className="text-sm text-muted-foreground">
                              {client.company}
                            </p>
                          )}
                        </div>
                        <Badge className={getStatusColor(client.status, client.client_type)}>
                          {formatStatus(client.status, customStatuses)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No clients yet. Create your first client to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards Section */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Leads (Week)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.newLeadsWeek}</div>
                <p className="text-xs text-muted-foreground">Presales added this week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Leads (Month)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.newLeadsMonth}</div>
                <p className="text-xs text-muted-foreground">Presales added this month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leads with "New" Tag</CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.newTagLeads}</div>
                <p className="text-xs text-muted-foreground">Within last 14 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Waiting for Offer</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.waitingForOffer}</div>
                <p className="text-xs text-muted-foreground">Presales clients</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  )
}



