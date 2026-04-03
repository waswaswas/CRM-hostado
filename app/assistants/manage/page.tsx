import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAssistantsAccessState } from '@/app/actions/ai-assistants'
import { AssistantsManageClient } from '@/app/assistants/manage/assistants-manage-client'
import { getOrganizationMembers } from '@/app/actions/organizations'

export const dynamic = 'force-dynamic'

export default async function AssistantsManagePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const access = await getAssistantsAccessState()
  if (!access.canManage) {
    redirect('/assistants')
  }
  if (!access.orgId) {
    redirect('/dashboard')
  }

  const members = await getOrganizationMembers(access.orgId)

  return (
    <AppLayout>
      <AssistantsManageClient organizationId={access.orgId} initialMembers={members} />
    </AppLayout>
  )
}
