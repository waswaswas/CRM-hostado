import { AppLayout } from '@/components/layout/app-layout'
import { ClientsList } from '@/components/clients/clients-list'
import { getClients } from '@/app/actions/clients'

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <AppLayout>
      <ClientsList initialClients={clients} />
    </AppLayout>
  )
}



