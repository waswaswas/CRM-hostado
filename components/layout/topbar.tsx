'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/actions/auth'
import { LogOut, User, MessageSquare } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { TimezoneSelector } from '@/components/timezone-selector'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { NotificationBadge } from '@/components/notifications/notification-badge'

export function Topbar({ userName }: { userName?: string }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <>
      <div className="flex h-16 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {userName || 'User'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBadge />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFeedbackOpen(true)}
            className="h-9 px-2 gap-1.5"
            title="Feedback & Improvements"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">Feedback</span>
          </Button>
          <TimezoneSelector />
          <ThemeToggle />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>
      </div>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  )
}



