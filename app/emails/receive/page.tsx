import { AppLayout } from '@/components/layout/app-layout'
import { ReceiveEmailForm } from '@/components/emails/receive-email-form'

export default function ReceiveEmailPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <ReceiveEmailForm />
      </div>
    </AppLayout>
  )
}





