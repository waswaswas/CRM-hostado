import { requireFeatureAccess } from '@/app/actions/organizations'
import { headers } from 'next/headers'

export default async function OffersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  if (headersList.get('x-offer-public-pay') !== '1') {
    await requireFeatureAccess('offers')
  }
  return <>{children}</>
}
