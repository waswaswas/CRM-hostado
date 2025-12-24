import { AppLayout } from '@/components/layout/app-layout'
import { EmailComposer } from '@/components/emails/email-composer'
import { getEmail } from '@/app/actions/emails'
import { notFound } from 'next/navigation'

export default async function ReplyEmailPage({
  params,
}: {
  params: { id: string }
}) {
  let originalEmail
  try {
    originalEmail = await getEmail(params.id)
  } catch (error) {
    notFound()
  }

  // Prepare reply subject
  const replySubject = originalEmail.subject.startsWith('Re: ')
    ? originalEmail.subject
    : `Re: ${originalEmail.subject}`

  // Prepare reply body with original email quoted
  const replyBody = `<p style="margin: 0 0 1em 0;"></p>
<div style="border-left: 3px solid #ccc; padding-left: 1em; margin: 1em 0; color: #666;">
  <p style="margin: 0 0 0.5em 0;"><strong>From:</strong> ${originalEmail.from_name} &lt;${originalEmail.from_email}&gt;</p>
  <p style="margin: 0 0 0.5em 0;"><strong>Date:</strong> ${new Date(originalEmail.sent_at || originalEmail.created_at).toLocaleString()}</p>
  <p style="margin: 0 0 0.5em 0;"><strong>Subject:</strong> ${originalEmail.subject}</p>
  <div style="margin-top: 1em;">
    ${originalEmail.body_html}
  </div>
</div>`

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <EmailComposer
          clientId={originalEmail.client_id}
          initialSubject={replySubject}
          initialBody={replyBody}
          initialToEmail={originalEmail.direction === 'inbound' ? originalEmail.from_email : originalEmail.to_email}
          initialToName={originalEmail.direction === 'inbound' ? originalEmail.from_name : originalEmail.to_name || undefined}
          templateId={undefined}
        />
      </div>
    </AppLayout>
  )
}

