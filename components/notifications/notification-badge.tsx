'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { getUnreadNotificationCount } from '@/app/actions/notifications'
import { useRouter } from 'next/navigation'

export function NotificationBadge() {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function fetchCount() {
      try {
        const count = await getUnreadNotificationCount()
        setUnreadCount(count)
      } catch (error) {
        console.error('Failed to fetch notification count:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCount()
    // Refresh count every 30 seconds
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Refresh count periodically and on focus
  useEffect(() => {
    const handleFocus = () => {
      getUnreadNotificationCount().then(setUnreadCount).catch(console.error)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const displayCount = unreadCount > 9 ? '9+' : unreadCount.toString()

  return (
    <Link href="/notifications">
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
    </Link>
  )
}






