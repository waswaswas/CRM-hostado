import { AppLayout } from '@/components/layout/app-layout'
import { OfferDetail } from '@/components/offers/offer-detail'
import { getOffer } from '@/app/actions/offers'
import { notFound } from 'next/navigation'

export default async function OfferDetailPage({ params }: { params: { id: string } }) {
  try {
    const offer = await getOffer(params.id)
    return (
      <AppLayout>
        <OfferDetail initialOffer={offer} />
      </AppLayout>
    )
  } catch (error) {
    notFound()
  }
}






