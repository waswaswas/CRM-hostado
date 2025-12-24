import { AppLayout } from '@/components/layout/app-layout'
import { EmailList } from '@/components/emails/email-list'
import { getEmails } from '@/app/actions/emails'

export default async function EmailsPage() {
  // Load sent emails by default
  const emails = await getEmails({ folder: 'sent' })

  return (
    <AppLayout>
      <EmailList initialEmails={emails} />
    </AppLayout>
  )
}









