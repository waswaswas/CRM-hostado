'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { AppLayoutClient } from '@/components/layout/app-layout-client'
import { EmailComposer } from '@/components/emails/email-composer'

function ComposeEmailContent() {
  const searchParams = useSearchParams()
  const clientId = searchParams?.get('client_id') || undefined
  const templateId = searchParams?.get('template_id') || undefined
  const subject = searchParams?.get('subject') || undefined
  const body = searchParams?.get('body') || undefined

  return (
    <EmailComposer
      clientId={clientId}
      templateId={templateId}
      initialSubject={subject}
      initialBody={body}
    />
  )
}

export default function ComposeEmailPage() {
  return (
    <AppLayoutClient>
      <Suspense fallback={<div>Loading...</div>}>
        <ComposeEmailContent />
      </Suspense>
    </AppLayoutClient>
  )
}





























