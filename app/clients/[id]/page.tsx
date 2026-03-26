import { notFound } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { getClient } from '@/app/actions/clients'
import { getAccountingCustomersByClientId } from '@/app/actions/accounting-customers'
import { ClientDetail } from '@/components/clients/client-detail'
import { getSettings } from '@/app/actions/settings'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let client
  try {
    client = await getClient(id)
  } catch (error) {
    notFound()
  }

  // Get linked accounting customers
  const linkedAccountingCustomers = await getAccountingCustomersByClientId(id).catch(() => [])
  const settings = await getSettings().catch(() => ({ custom_statuses: [] }))

  return (
    <AppLayout>
      <ClientDetail 
        client={client} 
        linkedAccountingCustomers={linkedAccountingCustomers}
        initialCustomStatuses={settings.custom_statuses || []}
      />
    </AppLayout>
  )
}



