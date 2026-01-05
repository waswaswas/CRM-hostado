'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/actions/auth'
import { LogOut, MessageSquare, MoreVertical } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { TimezoneSelector } from '@/components/timezone-selector'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { NotificationBadge } from '@/components/notifications/notification-badge'
import { FloatingActionButton } from '@/components/ui/floating-action-button'
import { OrganizationSelector } from '@/components/organizations/organization-selector'
import { usePathname } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Topbar({ userName }: { userName?: string }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <div className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <OrganizationSelector />
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {/* Theme Toggle - Always visible, before bell */}
          <ThemeToggle />
          <NotificationBadge />
          {/* Mobile: FAB Button (replaces top button) */}
          <div className="md:hidden">
            <FloatingActionButton currentPath={pathname} />
          </div>
          {/* Desktop: Show all buttons */}
          <div className="hidden md:flex items-center gap-2">
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
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="min-h-[44px]">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </form>
          </div>
          {/* Mobile: Dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 md:hidden">
                <MoreVertical className="h-5 w-5" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setFeedbackOpen(true)} className="min-h-[44px]">
                <MessageSquare className="mr-2 h-4 w-4" />
                Feedback
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <div className="text-xs font-medium mb-1">Timezone</div>
                <TimezoneSelector />
              </div>
              <DropdownMenuSeparator />
              <form action={signOut}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full text-left min-h-[44px]">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  )
}



