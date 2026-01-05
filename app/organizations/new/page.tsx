import { AppLayout } from '@/components/layout/app-layout'
import { OrganizationForm } from '@/components/organizations/organization-form'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NewOrganizationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Create Organization</h1>
          <p className="text-muted-foreground mt-1">
            Create a new organization to manage your team and data
          </p>
        </div>
        <OrganizationForm />
      </div>
    </AppLayout>
  )
}
