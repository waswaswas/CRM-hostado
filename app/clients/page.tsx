import { AppLayout } from '@/components/layout/app-layout'
import { ClientsList } from '@/components/clients/clients-list'
import { getClients } from '@/app/actions/clients'
import { getLinkedClientIds } from '@/app/actions/accounting-customers'

export default async function ClientsPage() {
  const clients = await getClients()
  
  // Get all client IDs that are linked to accounting customers
  const linkedClientIds = await getLinkedClientIds().catch(() => [])

  return (
    <AppLayout>
      <ClientsList 
        initialClients={clients}
        linkedClientIds={linkedClientIds}
      />
    </AppLayout>
  )
}



