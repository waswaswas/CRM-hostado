'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell } from 'lucide-react'
import { getNotifications, getUnreadNotificationCount, type Notification } from '@/app/actions/notifications'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function NotificationBadge() {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const [count, list] = await Promise.all([
          getUnreadNotificationCount(),
          getNotifications(6),
        ])
        setUnreadCount(count)
        setNotifications(list)
      } catch (error) {
        console.error('Failed to fetch notification count:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
    // Refresh count every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Refresh count periodically and on focus
  useEffect(() => {
    const handleFocus = () => {
      Promise.all([getUnreadNotificationCount(), getNotifications(6)])
        .then(([count, list]) => {
          setUnreadCount(count)
          setNotifications(list)
        })
        .catch(console.error)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const displayCount = unreadCount > 9 ? '9+' : unreadCount.toString()

  const getNotificationLink = (notification: Notification): string | null => {
    if (notification.related_type === 'email' && notification.related_id) {
      return `/emails/${notification.related_id}`
    }
    if (notification.related_type === 'reminder' && notification.related_id) {
      return '/dashboard'
    }
    if (notification.related_type === 'client' && notification.related_id) {
      return `/clients/${notification.related_id}`
    }
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 gap-1.5 relative"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs font-bold"
            >
              {displayCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Notifications
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {loading ? 'Loading...' : 'No notifications'}
          </div>
        ) : (
          notifications.map((notification) => {
            const link = getNotificationLink(notification)
            return (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => {
                  if (link) {
                    router.push(link)
                  }
                }}
                className="flex flex-col items-start gap-1 py-2"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-medium truncate">
                    {notification.title}
                  </span>
                  {!notification.is_read && (
                    <Badge variant="secondary" className="text-[10px]">New</Badge>
                  )}
                </div>
                {notification.message && (
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(notification.created_at), 'MMM d, HH:mm')}
                </span>
              </DropdownMenuItem>
            )
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/notifications')}>
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}







