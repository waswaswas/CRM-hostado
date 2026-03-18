import { AppLayout } from '@/components/layout/app-layout'
import { OrganizationsList } from '@/components/organizations/organizations-list'
import { getOrganizations, getUserRole } from '@/app/actions/organizations'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OrganizationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const organizations = await getOrganizations()
  const initialUserRoles: Record<string, 'owner' | 'admin' | 'moderator' | 'viewer' | null> = {}
  await Promise.all(
    organizations.map(async (org) => {
      const role = await getUserRole(org.id)
      initialUserRoles[org.id] = role
    })
  )

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organizations and team members
          </p>
        </div>
        <OrganizationsList initialOrganizations={organizations} initialUserRoles={initialUserRoles} />
      </div>
    </AppLayout>
  )
}

