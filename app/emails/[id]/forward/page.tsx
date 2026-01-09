import { AppLayout } from '@/components/layout/app-layout'
import { EmailComposer } from '@/components/emails/email-composer'
import { getEmail } from '@/app/actions/emails'
import { notFound } from 'next/navigation'

export default async function ForwardEmailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let originalEmail
  try {
    originalEmail = await getEmail(id)
  } catch (error) {
    notFound()
  }

  // Prepare forward subject
  const forwardSubject = originalEmail.subject.startsWith('Fwd: ') || originalEmail.subject.startsWith('Fw: ')
    ? originalEmail.subject
    : `Fwd: ${originalEmail.subject}`

  // Prepare forward body with original email
  const forwardBody = `<p style="margin: 0 0 1em 0;"></p>
<div style="border-left: 3px solid #ccc; padding-left: 1em; margin: 1em 0; color: #666;">
  <p style="margin: 0 0 0.5em 0;"><strong>From:</strong> ${originalEmail.from_name} &lt;${originalEmail.from_email}&gt;</p>
  <p style="margin: 0 0 0.5em 0;"><strong>Date:</strong> ${new Date(originalEmail.sent_at || originalEmail.created_at).toLocaleString()}</p>
  <p style="margin: 0 0 0.5em 0;"><strong>Subject:</strong> ${originalEmail.subject}</p>
  ${originalEmail.to_name ? `<p style="margin: 0 0 0.5em 0;"><strong>To:</strong> ${originalEmail.to_name} &lt;${originalEmail.to_email}&gt;</p>` : ''}
  <div style="margin-top: 1em;">
    ${originalEmail.body_html}
  </div>
</div>`

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <EmailComposer
          clientId={originalEmail.client_id}
          initialSubject={forwardSubject}
          initialBody={forwardBody}
          templateId={undefined}
        />
      </div>
    </AppLayout>
  )
}





















