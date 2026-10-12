import { AppLayout } from '@/components/layout/app-layout'
import { NewOfferForm } from '@/components/offers/new-offer-form'
import { getClientsForSelect } from '@/app/actions/clients'

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>
}) {
  const params = await searchParams
  const clients = await getClientsForSelect()
  const initialClientId =
    params.client_id && clients.some((c) => c.id === params.client_id)
      ? params.client_id
      : ''

  return (
    <AppLayout>
      <NewOfferForm initialClients={clients} initialClientId={initialClientId} />
    </AppLayout>
  )
}
