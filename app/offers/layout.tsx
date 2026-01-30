import { requireFeatureAccess } from '@/app/actions/organizations'

export default async function OffersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFeatureAccess('offers')
  return <>{children}</>
}
