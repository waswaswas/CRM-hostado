import { requireFeatureAccess } from '@/app/actions/organizations'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFeatureAccess('settings')
  return <>{children}</>
}
