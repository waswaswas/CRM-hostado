import { requireAdminSession } from '@/app/actions/admin'
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client'

export default async function AdminDashboardPage() {
  await requireAdminSession()
  return (
    <div className="container max-w-7xl py-6">
      <AdminDashboardClient />
    </div>
  )
}
