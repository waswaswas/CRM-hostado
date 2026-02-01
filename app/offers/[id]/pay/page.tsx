import { getOfferByToken } from '@/app/actions/offers'
import { PublicPaymentPage } from '@/components/offers/public-payment-page'
import { notFound } from 'next/navigation'

export default async function PayOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token } = await searchParams
  if (!token) {
    notFound()
  }

  try {
    const offer = await getOfferByToken(token)
    if (offer.id !== id) {
      notFound()
    }
    return <PublicPaymentPage offer={offer} token={token} />
  } catch (error) {
    notFound()
  }
}



































