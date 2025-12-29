import { getAccountingCustomer } from '@/app/actions/accounting-customers'
import { getTransactions } from '@/app/actions/transactions'
import { getClients } from '@/app/actions/clients'
import { AccountingCustomerDetail } from '@/components/accounting/accounting-customer-detail'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export default async function AccountingCustomerDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const customer = await getAccountingCustomer(params.id)
  if (!customer) {
    notFound()
  }

  // Get customer's transactions (using accounting_customer_id)
  const transactions = await getTransactions({ accounting_customer_id: params.id }).catch(() => [])

  // Get offers if customer is linked to a CRM client
  let offers: any[] = []
  if (customer.linked_client_id) {
    const { getOffersForClient } = await import('@/app/actions/offers')
    offers = await getOffersForClient(customer.linked_client_id).catch(() => [])
  }

  // Get all CRM clients for linking
  const crmClients = await getClients()

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AccountingCustomerDetail 
          customer={customer} 
          transactions={transactions}
          offers={offers}
          crmClients={crmClients}
        />
      </div>
    </AppLayout>
  )
}




