'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  getNotifications, 
  markNotificationAsRead, 
  markNotificationAsUnread, 
  deleteNotification,
  markAllNotificationsAsRead,
  type Notification
} from '@/app/actions/notifications'
import { useToast } from '@/components/ui/toaster'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { 
  Mail, 
  Bell, 
  Tag, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  CheckCheck,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'

interface NotificationsListProps {
  initialNotifications: Notification[]
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'email':
      return Mail
    case 'reminder':
      return Bell
    case 'tag_removed':
      return Tag
    default:
      return Bell
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case 'email':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'reminder':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    case 'tag_removed':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

function getNotificationLink(notification: Notification): string | null {
  if (notification.related_type === 'email' && notification.related_id) {
    return `/emails/${notification.related_id}`
  }
  if (notification.related_type === 'reminder' && notification.related_id) {
    return '/dashboard' // Reminders are shown on dashboard
  }
  if (notification.related_type === 'client' && notification.related_id) {
    return `/clients/${notification.related_id}`
  }
  return null
}

export function NotificationsList({ initialNotifications }: NotificationsListProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [loading, setLoading] = useState(false)

  async function handleMarkAsRead(id: string) {
    setLoading(true)
    try {
      await markNotificationAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      )
      toast({
        title: 'Success',
        description: 'Notification marked as read',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark notification as read',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkAsUnread(id: string) {
    setLoading(true)
    try {
      await markNotificationAsUnread(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false, read_at: null } : n))
      )
      toast({
        title: 'Success',
        description: 'Notification marked as unread',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark notification as unread',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this notification?')) {
      return
    }

    setLoading(true)
    try {
      await deleteNotification(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      toast({
        title: 'Success',
        description: 'Notification deleted',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete notification',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkAllAsRead() {
    setLoading(true)
    try {
      await markAllNotificationsAsRead()
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark all as read',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="space-y-4">
      {/* Header with Mark All as Read */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={loading}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        </div>
      )}

      {/* Notifications List */}
      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type)
            const link = getNotificationLink(notification)

            return (
              <Card
                key={notification.id}
                className={`transition-colors ${
                  !notification.is_read
                    ? 'border-primary/50 bg-primary/5'
                    : 'bg-muted/30'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${getNotificationColor(notification.type)}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-semibold ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {notification.title}
                            </h3>
                            {!notification.is_read && (
                              <Badge variant="secondary" className="text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                          {notification.message && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(notification.created_at), 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {notification.is_read ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsUnread(notification.id)}
                              disabled={loading}
                              className="h-8 w-8 p-0"
                              title="Mark as unread"
                            >
                              <Circle className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                              disabled={loading}
                              className="h-8 w-8 p-0"
                              title="Mark as read"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(notification.id)}
                            disabled={loading}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {link && (
                            <Link href={link}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="View"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No notifications</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


