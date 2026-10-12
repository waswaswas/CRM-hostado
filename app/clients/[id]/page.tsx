import { notFound } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { getClient } from '@/app/actions/clients'
import { getAccountingCustomersByClientId } from '@/app/actions/accounting-customers'
import { ClientDetail } from '@/components/clients/client-detail'
import { getSettings } from '@/app/actions/settings'
import { getInteractionsForClient } from '@/app/actions/interactions'
import { getRemindersForClient } from '@/app/actions/reminders'
import { getNotesForClient } from '@/app/actions/notes'
import { getOffersForClient } from '@/app/actions/offers'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let client
  try {
    client = await getClient(id)
  } catch {
    notFound()
  }

  const [
    linkedAccountingCustomers,
    settings,
    interactions,
    reminders,
    notes,
    offers,
  ] = await Promise.all([
    getAccountingCustomersByClientId(id).catch(() => []),
    getSettings().catch(() => ({ custom_statuses: [] })),
    getInteractionsForClient(id).catch(() => []),
    getRemindersForClient(id).catch(() => []),
    getNotesForClient(id).catch(() => []),
    getOffersForClient(id).catch(() => []),
  ])

  return (
    <AppLayout>
      <ClientDetail
        client={client}
        linkedAccountingCustomers={linkedAccountingCustomers}
        initialCustomStatuses={settings.custom_statuses || []}
        initialInteractions={interactions}
        initialReminders={reminders}
        initialNotes={notes}
        initialOffers={offers}
      />
    </AppLayout>
  )
}
