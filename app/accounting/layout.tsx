import { requireFeatureAccess } from '@/app/actions/organizations'

export default async function AccountingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFeatureAccess('accounting')
  return <>{children}</>
}
