import { AppLayout } from '@/components/layout/app-layout'
import { ClientsList } from '@/components/clients/clients-list'
import { getClients } from '@/app/actions/clients'
import { getLinkedClientIds } from '@/app/actions/accounting-customers'
import { getCurrentUserOrgRole } from '@/app/actions/organizations'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const [clients, linkedClientIds, role] = await Promise.all([
    getClients(),
    getLinkedClientIds().catch(() => []),
    getCurrentUserOrgRole(),
  ])
  const canDelete = role === 'owner' || role === 'admin'

  return (
    <AppLayout>
      <ClientsList 
        initialClients={clients}
        linkedClientIds={linkedClientIds}
        canDelete={canDelete}
      />
    </AppLayout>
  )
}



