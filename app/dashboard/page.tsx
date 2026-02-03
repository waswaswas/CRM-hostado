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
import { Calendar, Users, AlertCircle, TrendingUp, Clock, Tag, List, LayoutDashboard, FileText } from 'lucide-react'
import type { Client } from '@/types/database'
import { RemindersCard } from '@/components/dashboard/reminders-card'
import { RecentClients } from '@/components/dashboard/recent-clients'
import { NoPermissionsCard } from '@/components/dashboard/no-permissions-card'
import { format, parseISO } from 'date-fns'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrganizations, getCurrentOrganizationId, setCurrentOrganizationId, getDashboardPermissionContext } from '@/app/actions/organizations'
import { revalidatePath } from 'next/cache'

function formatDateTime(dateString: string) {
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm')
  } catch {
    return dateString
  }
}

export default async function DashboardPage() {
  // Check if user has any organizations
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: members } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    // If user has no organizations, redirect to join/create page
    if (!members || members.length === 0) {
      redirect('/join-organization')
    }

    // Ensure a current organization is set - auto-select first one if none selected
    // This is critical for server-side rendering to work correctly
    const currentOrgId = await getCurrentOrganizationId()
    if (!currentOrgId) {
      const organizations = await getOrganizations()
      if (organizations && organizations.length > 0) {
        await setCurrentOrganizationId(organizations[0].id)
        // Revalidate the layout to ensure organization context is updated
        revalidatePath('/', 'layout')
      }
    }
  }

  const permContext = await getDashboardPermissionContext()

  // No permissions at all: show message and refresh button instead of dashboard
  if (!permContext.hasAnyPermission) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <NoPermissionsCard />
        </div>
      </AppLayout>
    )
  }

  // User has only To-Do List permission (no dashboard): redirect to To-Do List
  if (permContext.hasTodo && !permContext.hasDashboard) {
    redirect('/todo')
  }

  let reminders = []
  let clients = []
  let stats = { newLeadsWeek: 0, newLeadsMonth: 0, newTagLeads: 0, waitingForOffer: 0 }
  let dbError = null
  let customStatuses: Array<{ key: string; label: string }> = []

  let completedReminders = []

  try {
    if (permContext.hasReminders) {
      reminders = await getUpcomingReminders()
      completedReminders = await getCompletedReminders()
    }
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
  })

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
        </div>

        <div className={`grid gap-6 ${permContext.hasClients || permContext.hasReminders ? 'md:grid-cols-2' : ''}`}>
          {permContext.hasReminders && (
            <RemindersCard 
              reminders={reminders}
              overdueReminders={overdueReminders}
              todayReminders={todayReminders}
              upcomingReminders={upcomingReminders}
              completedReminders={completedReminders}
              clients={clients}
            />
          )}

          {permContext.hasClients && (
            <RecentClients initialClients={clients} customStatuses={customStatuses} />
          )}

          {!permContext.hasReminders && !permContext.hasClients && (
            <Card className="md:col-span-2">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Welcome to your Dashboard</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Use the sidebar to navigate to Clients, Offers, Emails, To-Do List, or other sections you have access to.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Link href="/clients">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Users className="h-4 w-4" />
                      Clients
                    </Button>
                  </Link>
                  <Link href="/offers">
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Offers
                    </Button>
                  </Link>
                  <Link href="/todo">
                    <Button variant="outline" size="sm" className="gap-2">
                      <List className="h-4 w-4" />
                      To-Do List
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stats Cards (leads + waiting for offer) — only when user has Clients permission */}
        {permContext.hasClients && stats && (
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



