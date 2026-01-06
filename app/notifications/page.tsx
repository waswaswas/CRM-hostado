import { AppLayout } from '@/components/layout/app-layout'
import { NotificationsList } from '@/components/notifications/notifications-list'
import { getNotifications } from '@/app/actions/notifications'

export default async function NotificationsPage() {
  const notifications = await getNotifications()

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Notifications</h1>
        </div>
        <NotificationsList initialNotifications={notifications} />
      </div>
    </AppLayout>
  )
}







