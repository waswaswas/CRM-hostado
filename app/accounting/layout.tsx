import { requireFeatureAccess } from '@/app/actions/organizations'
import { CurrencyDisplayProvider } from '@/lib/currency-display-context'

export default async function AccountingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFeatureAccess('accounting')
  return <CurrencyDisplayProvider>{children}</CurrencyDisplayProvider>
}
