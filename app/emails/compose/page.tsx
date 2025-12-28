'use client'

import { useSearchParams } from 'next/navigation'
import { AppLayoutClient } from '@/components/layout/app-layout-client'
import { EmailComposer } from '@/components/emails/email-composer'

export default function ComposeEmailPage() {
  const searchParams = useSearchParams()
  const clientId = searchParams?.get('client_id') || undefined
  const templateId = searchParams?.get('template_id') || undefined
  const subject = searchParams?.get('subject') || undefined
  const body = searchParams?.get('body') || undefined

  return (
    <AppLayoutClient>
      <EmailComposer
        clientId={clientId}
        templateId={templateId}
        initialSubject={subject}
        initialBody={body}
      />
    </AppLayoutClient>
  )
}














