'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { OrganizationProvider } from '@/lib/organization-context'

const SIDEBAR_COLLAPSED_KEY = 'hostado-sidebar-collapsed'

export function LayoutShell({
  userName,
  children,
}: {
  userName?: string
  children: React.ReactNode
}) {
  const [collapsed, setCollapsedState] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.height = '100%'
    document.body.style.overflow = 'hidden'
    document.body.style.height = '100%'
    return () => {
      document.documentElement.style.overflow = ''
      document.documentElement.style.height = ''
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      setCollapsedState(stored === 'true')
    } catch {
      // ignore
    }
  }, [mounted])

  const onToggleCollapse = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  return (
    <OrganizationProvider>
      <div className="fixed inset-0 flex h-[100dvh] overflow-hidden">
        <Sidebar
          userName={userName}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
        <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
          <Topbar userName={userName} sidebarCollapsed={collapsed} />
          <main className="app-main-scroll flex-1 min-h-0 overflow-y-auto overscroll-y-contain overflow-x-hidden md:overflow-x-auto bg-muted/50 p-4 sm:p-4 md:p-5 lg:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] min-w-0">
            {children}
          </main>
        </div>
      </div>
    </OrganizationProvider>
  )
}
