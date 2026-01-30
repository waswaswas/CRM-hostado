import { requireFeatureAccess } from '@/app/actions/organizations'

export default async function ClientsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFeatureAccess('clients')
  return <>{children}</>
}
