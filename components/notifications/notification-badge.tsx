'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Bell } from 'lucide-react'
import { NotificationPreferencesButton } from './notification-preferences-dialog'
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
    if (notification.related_type === 'todo_task' && notification.related_id) {
      const listId = notification.metadata?.list_id
      return listId ? `/todo?list=${listId}&task=${notification.related_id}` : '/todo'
    }
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-lg relative text-muted-foreground hover:text-foreground hover:bg-muted/50"
          title="Notifications"
          aria-label={`${unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground ring-2 ring-background"
              aria-hidden
            >
              {displayCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-xl border-border/80 shadow-lg">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notifications
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
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
                className="flex flex-col items-start gap-1.5 rounded-lg py-3 mx-1 min-h-[52px] cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-2 w-full min-w-0">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate text-sm">
                        {notification.title}
                      </span>
                      {!notification.is_read && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 rounded-md">New</Badge>
                      )}
                    </div>
                    {notification.message && (
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground/80">
                      {format(new Date(notification.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  {link && (
                    <span className="shrink-0 rounded p-1 text-muted-foreground group-hover:text-foreground" title="Go to">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            )
          })
        )}
        <DropdownMenuSeparator />
        <div className="px-2 py-1 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <NotificationPreferencesButton />
          </div>
          <DropdownMenuItem onClick={() => router.push('/notifications')} className="rounded-lg min-h-[40px] font-medium">
            View all notifications
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}







