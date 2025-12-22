'use client'

import { useSearchParams } from 'next/navigation'
import { AppLayoutClient } from '@/components/layout/app-layout-client'
import { TemplateComposer } from '@/components/emails/template-composer'

export default function NewTemplatePage() {
  const searchParams = useSearchParams()
  const templateId = searchParams?.get('template_id') || undefined
  const name = searchParams?.get('name') || undefined
  const subject = searchParams?.get('subject') || undefined
  const body = searchParams?.get('body') || undefined
  const category = searchParams?.get('category') || undefined

  return (
    <AppLayoutClient>
      <TemplateComposer
        templateId={templateId}
        initialName={name}
        initialSubject={subject}
        initialBody={body}
        initialCategory={category as any}
      />
    </AppLayoutClient>
  )
}
