import { AppLayout } from '@/components/layout/app-layout'
import { NoPermissionsCard } from '@/components/dashboard/no-permissions-card'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getOrganizations,
  getCurrentOrganizationId,
  setCurrentOrganizationId,
  getDashboardPermissionContext,
} from '@/app/actions/organizations'
import { revalidatePath } from 'next/cache'
import { DashboardPageClient } from '@/app/dashboard/dashboard-page-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let permContext: Awaited<ReturnType<typeof getDashboardPermissionContext>> | undefined

  if (user) {
    const { data: members } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (!members || members.length === 0) {
      redirect('/join-organization')
    }

    const currentOrgId = await getCurrentOrganizationId()
    let effectiveOrgId: string | null = currentOrgId
    if (!currentOrgId) {
      const organizations = await getOrganizations()
      if (organizations && organizations.length > 0) {
        effectiveOrgId = organizations[0].id
        await setCurrentOrganizationId(organizations[0].id)
        revalidatePath('/', 'layout')
      }
    }
    permContext = await getDashboardPermissionContext(effectiveOrgId ?? undefined)
  }
  if (permContext === undefined) {
    permContext = await getDashboardPermissionContext()
  }

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

  if (permContext.hasTodo && !permContext.hasDashboard) {
    redirect('/todo')
  }

  const emptyStats = {
    newLeadsWeek: 0,
    newLeadsMonth: 0,
    newTagLeads: 0,
    waitingForOffer: 0,
  }

  return (
    <AppLayout>
      <DashboardPageClient
        permContext={permContext}
        initialReminders={[]}
        initialCompletedReminders={[]}
        initialClients={[]}
        initialStats={emptyStats}
        initialCustomStatuses={[]}
      />
    </AppLayout>
  )
}
