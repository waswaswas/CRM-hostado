import { redirect } from 'next/navigation'
import { getAdminSession } from '@/app/actions/admin'
import { AdminCenterLogin } from '@/components/admin/admin-center-login'

export default async function AdminCenterPage() {
  const isAdmin = await getAdminSession()
  if (isAdmin) {
    redirect('/admincenter/dashboard')
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AdminCenterLogin />
    </div>
  )
}
