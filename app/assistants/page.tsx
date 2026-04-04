import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAssistantsAccessState } from '@/app/actions/ai-assistants'
import { getClients } from '@/app/actions/clients'
import {
  buildAssistantClientMentionOptions,
  type AssistantMentionClient,
} from '@/lib/ai-assistants/assistant-mention-options'
import { AssistantsPageClient } from '@/app/assistants/assistants-page-client'
import type { Client } from '@/types/database'

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

  let mentionClients: AssistantMentionClient[] = []
  try {
    const clients = await getClients()
    mentionClients = buildAssistantClientMentionOptions(
      clients.map((c: Client) => ({
        id: c.id,
        name: c.name,
        company: c.company,
      }))
    )
  } catch {
    mentionClients = []
  }

  return (
    <AppLayout>
      <AssistantsPageClient
        allowedBotIds={access.allowedBotIds}
        canManage={access.canManage}
        mentionClients={mentionClients}
      />
    </AppLayout>
  )
}
