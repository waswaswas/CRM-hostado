import { AppLayout } from '@/components/layout/app-layout'
import { OfferDocumentView } from '@/components/offers/offer-document-view'
import { getOffer } from '@/app/actions/offers'
import { notFound } from 'next/navigation'

export default async function OfferDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const { id } = await params
  const { print } = await searchParams
  try {
    const offer = await getOffer(id)
    return (
      <AppLayout>
        <OfferDocumentView offer={offer} autoPrint={print === '1'} />
      </AppLayout>
    )
  } catch {
    notFound()
  }
}
