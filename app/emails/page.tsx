import { AppLayout } from '@/components/layout/app-layout'
import { EmailList } from '@/components/emails/email-list'
import { EmailSetupPrompt } from '@/components/emails/email-setup-prompt'
import { getEmails } from '@/app/actions/emails'
import { getOrganizationEmailSetupStatus } from '@/app/actions/organizations'

export default async function EmailsPage() {
  const [emails, setupStatus] = await Promise.all([
    getEmails(),
    getOrganizationEmailSetupStatus(),
  ])

  const showSetupPrompt =
    !setupStatus.isHostado && !setupStatus.hasEmailSettings && setupStatus.organizationName

  return (
    <AppLayout>
      <div className="space-y-6">
        {showSetupPrompt && (
          <EmailSetupPrompt organizationName={setupStatus.organizationName} />
        )}
        <EmailList initialEmails={emails} />
      </div>
    </AppLayout>
  )
}





























