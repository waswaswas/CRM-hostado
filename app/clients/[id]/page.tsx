import { notFound } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { getClient } from '@/app/actions/clients'
import { ClientDetail } from '@/components/clients/client-detail'

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string }
}) {
  let client
  try {
    client = await getClient(params.id)
  } catch (error) {
    notFound()
  }

  return (
    <AppLayout>
      <ClientDetail client={client} />
    </AppLayout>
  )
}



