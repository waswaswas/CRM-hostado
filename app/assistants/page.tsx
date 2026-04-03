import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAssistantsAccessState } from '@/app/actions/ai-assistants'
import { AssistantsPageClient } from '@/app/assistants/assistants-page-client'

export const dynamic = 'force-dynamic'

export default async function AssistantsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const access = await getAssistantsAccessState()
  if (!access.canUseFeature) {
    redirect('/dashboard')
  }

  return (
    <AppLayout>
      <AssistantsPageClient
        allowedBotIds={access.allowedBotIds}
        canManage={access.canManage}
      />
    </AppLayout>
  )
}
