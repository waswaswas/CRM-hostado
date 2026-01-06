import { AppLayout } from '@/components/layout/app-layout'
import { EmailDetail } from '@/components/emails/email-detail'
import { getEmail } from '@/app/actions/emails'
import { notFound } from 'next/navigation'

export default async function EmailDetailPage({
  params,
}: {
  params: { id: string }
}) {
  let email
  try {
    email = await getEmail(params.id)
  } catch (error) {
    notFound()
  }

  return (
    <AppLayout>
      <EmailDetail initialEmail={email} />
    </AppLayout>
  )
}





























