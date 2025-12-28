'use client'

import { AppLayoutClient } from '@/components/layout/app-layout-client'
import { TemplateEditor } from '@/components/emails/template-editor'

export default function NewTemplatePage() {
  return (
    <AppLayoutClient>
      <div className="mx-auto max-w-4xl space-y-6">
        <TemplateEditor />
      </div>
    </AppLayoutClient>
  )
}















