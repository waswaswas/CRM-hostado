import { AppLayout } from '@/components/layout/app-layout'
import { OffersList } from '@/components/offers/offers-list'
import { getOffers } from '@/app/actions/offers'

export default async function OffersPage() {
  const offers = await getOffers()

  return (
    <AppLayout>
      <OffersList initialOffers={offers} />
    </AppLayout>
  )
}













