'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

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
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userName={userName}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Topbar userName={userName} sidebarCollapsed={collapsed} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto bg-muted/50 p-4 sm:p-4 md:p-5 lg:p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
