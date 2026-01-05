import { AppLayout } from '@/components/layout/app-layout'
import { OrganizationMembersList } from '@/components/organizations/organization-members-list'
import { getOrganization, getOrganizationMembers, getUserRole } from '@/app/actions/organizations'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OrganizationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const organization = await getOrganization(params.id)
  if (!organization) {
    notFound()
  }

  const members = await getOrganizationMembers(params.id)
  const userRole = await getUserRole(params.id)

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{organization.name}</h1>
          <p className="text-muted-foreground mt-1">
            Manage organization settings and members
          </p>
        </div>
        <OrganizationMembersList
          organization={organization}
          initialMembers={members}
          userRole={userRole}
        />
      </div>
    </AppLayout>
  )
}
