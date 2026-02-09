import { AppLayout } from '@/components/layout/app-layout'
import { NotificationsList } from '@/components/notifications/notifications-list'
import { NotificationPreferencesButton } from '@/components/notifications/notification-preferences-dialog'
import { getNotifications } from '@/app/actions/notifications'

export default async function NotificationsPage() {
  const notifications = await getNotifications()

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <h1 className="text-xl font-bold truncate min-w-0 sm:text-2xl md:text-3xl">Notifications</h1>
          <NotificationPreferencesButton />
        </div>
        <NotificationsList initialNotifications={notifications} />
      </div>
    </AppLayout>
  )
}







