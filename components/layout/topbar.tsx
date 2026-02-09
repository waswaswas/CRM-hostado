'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
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

export function Topbar({ userName, sidebarCollapsed }: { userName?: string; sidebarCollapsed?: boolean }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <div
        className={cn(
          'flex h-14 sm:h-16 items-center justify-between gap-4 border-b border-border/80 bg-background px-4 pr-4 transition-[padding] duration-300',
          'pl-16 md:pl-5 md:pr-5 lg:px-6', // mobile: space for hamburger; tablet+: comfortable padding
          sidebarCollapsed && 'md:pl-4'
        )}
      >
        {/* Left: org selector */}
        <div className="flex min-w-0 flex-1 items-center">
          <OrganizationSelector />
        </div>

        {/* Right: actions — grouped and spaced for clarity */}
        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <div className="min-h-[44px] min-w-[44px] flex items-center justify-center">
            <NotificationBadge />
          </div>
          <div className="md:hidden">
            <FloatingActionButton currentPath={pathname} />
          </div>
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            <div className="h-6 w-px bg-border hidden lg:block" aria-hidden />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFeedbackOpen(true)}
              className="h-10 min-h-[44px] px-4 gap-2 rounded-lg text-muted-foreground hover:text-foreground"
              title="Feedback & Improvements"
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="text-sm">Feedback</span>
            </Button>
            <TimezoneSelector />
            <div className="h-6 w-px bg-border hidden lg:block" aria-hidden />
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-10 min-h-[44px] px-4 gap-2 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="text-sm">Logout</span>
              </Button>
            </form>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 md:hidden rounded-lg min-h-[44px] min-w-[44px]" aria-label="More options">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-lg">
              <DropdownMenuItem onClick={() => setFeedbackOpen(true)} className="min-h-[44px] rounded-md">
                <MessageSquare className="mr-2 h-4 w-4" />
                Feedback
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <div className="text-xs font-medium mb-1 text-muted-foreground">Timezone</div>
                <TimezoneSelector />
              </div>
              <DropdownMenuSeparator />
              <form action={signOut}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full text-left min-h-[44px] rounded-md flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
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



