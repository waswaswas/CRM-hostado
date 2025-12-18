'use client'

import { Button } from '@/components/ui/button'
import { signOut } from '@/app/actions/auth'
import { LogOut, User } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { TimezoneSelector } from '@/components/timezone-selector'

export function Topbar({ userName }: { userName?: string }) {
  return (
    <div className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {userName || 'User'}
        </span>
      </div>
      <div className="flex items-center gap-2">
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
  )
}



