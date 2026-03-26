import { AppLayout } from '@/components/layout/app-layout'
import { ClientsList } from '@/components/clients/clients-list'
import { getClients } from '@/app/actions/clients'
import { getLinkedClientIds } from '@/app/actions/accounting-customers'
import { getCurrentUserOrgRole } from '@/app/actions/organizations'
import { getSettings } from '@/app/actions/settings'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const [clients, linkedClientIds, role, settings] = await Promise.all([
    getClients(),
    getLinkedClientIds().catch(() => []),
    getCurrentUserOrgRole(),
    getSettings().catch(() => ({ custom_statuses: [] })),
  ])
  const canDelete = role === 'owner' || role === 'admin'

  return (
    <AppLayout>
      <ClientsList 
        initialClients={clients}
        linkedClientIds={linkedClientIds}
        canDelete={canDelete}
        initialCustomStatuses={settings.custom_statuses || []}
      />
    </AppLayout>
  )
}



