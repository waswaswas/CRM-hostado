import { requireFeatureAccess } from '@/app/actions/organizations'

export default async function EmailsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFeatureAccess('emails')
  return <>{children}</>
}
