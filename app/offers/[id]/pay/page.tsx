import { getOfferByToken } from '@/app/actions/offers'
import { PublicPaymentPage } from '@/components/offers/public-payment-page'
import { notFound } from 'next/navigation'

export default async function PayOfferPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { token?: string }
}) {
  if (!searchParams.token) {
    notFound()
  }

  try {
    const offer = await getOfferByToken(searchParams.token)
    if (offer.id !== params.id) {
      notFound()
    }
    return <PublicPaymentPage offer={offer} />
  } catch (error) {
    notFound()
  }
}























