'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Users, Settings, FileText, Mail, Building2, Menu, X, User, ListTodo, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFeaturePermissions, type Feature } from '@/lib/hooks/use-feature-permissions'
import { useOrganization } from '@/lib/organization-context'

type SidebarNavItem =
  | { name: string; href: string; icon: LucideIcon; feature: Feature }
  | { name: string; href: string; icon: LucideIcon; assistantsOnly: true }

const allNavigation: SidebarNavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, feature: 'dashboard' },
  { name: 'Clients', href: '/clients', icon: Users, feature: 'clients' },
  { name: 'Offers', href: '/offers', icon: FileText, feature: 'offers' },
  { name: 'Emails', href: '/emails', icon: Mail, feature: 'emails' },
  { name: 'Accounting', href: '/accounting', icon: Building2, feature: 'accounting' },
  { name: 'To-Do List', href: '/todo', icon: ListTodo, feature: 'todo' },
  { name: 'Assistants', href: '/assistants', icon: Sparkles, assistantsOnly: true },
]

interface SidebarProps {
  userName?: string
  /** Tablet/desktop only: when true, sidebar shows only the expand arrow. */
  collapsed?: boolean
  /** Tablet/desktop only: toggle collapse. */
  onToggleCollapse?: () => void
}

export function Sidebar({ userName, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { permissions, loading: permissionsLoading, assistantsCanOpen } = useFeaturePermissions()
  const { isLoading: orgLoading } = useOrganization()

  const isLoading = orgLoading || permissionsLoading

  const navigation = allNavigation.filter((item) => {
    if ('assistantsOnly' in item && item.assistantsOnly) {
      if (isLoading && assistantsCanOpen !== true) return false
      return assistantsCanOpen === true
    }
    if (!('feature' in item)) return false
    const feature = item.feature
    if (isLoading && permissions[feature] !== true) {
      return false
    }
    return permissions[feature] === true
  })

  const showCollapseToggle = Boolean(onToggleCollapse)

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="no-touch-target fixed left-4 top-2 z-50 h-10 w-10 md:hidden sm:top-3"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile drawer; tablet/desktop: collapsible with arrow */}
      <div
        className={cn(
          'fixed md:relative inset-y-0 left-0 z-40 flex h-full flex-col border-r bg-card shrink-0 transition-[width,transform] duration-300 ease-in-out',
          'md:flex-row md:overflow-hidden',
          // Mobile: slide in/out
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          // Mobile: fixed width for drawer
          'w-64',
          // Tablet/desktop: collapsible width when toggle provided (224px expanded, 56px collapsed); else fixed
          showCollapseToggle ? (collapsed ? 'md:w-14' : 'md:w-56 lg:w-64') : 'md:w-56 lg:w-64'
        )}
      >
        {/* Main content: logo, nav, user — hidden when collapsed on tablet/desktop */}
        <div
          className={cn(
            'flex flex-1 flex-col min-w-0',
            collapsed && showCollapseToggle && 'md:w-0 md:flex-none md:overflow-hidden md:opacity-0 md:pointer-events-none md:min-w-0'
          )}
        >
          <div className={cn('flex flex-col border-b md:border-b', collapsed && showCollapseToggle && 'md:hidden')}>
            <div className="flex h-20 sm:h-24 items-center justify-center px-4">
              <Link
                href="/dashboard"
                className="flex items-center justify-center w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                aria-label="Hostado - Go to Dashboard"
              >
                <img
                  src="/hostado-logo.png"
                  alt="hostado®"
                  className="h-12 w-auto max-w-[160px] object-contain object-center sm:h-14"
                />
              </Link>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
            {navigation.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px] min-w-[44px]',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.name === 'Accounting' && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Beta
                      </Badge>
                    )}
                  </Link>
                )
              })}
          </nav>
          {userName && (
            <div className={cn('border-t p-3 sm:p-4', collapsed && showCollapseToggle && 'md:hidden')}>
              <div className="flex items-center gap-2 px-3 py-2 min-h-[44px]">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">{userName}</span>
              </div>
            </div>
          )}
          <div className={cn('border-t p-3 sm:p-4', collapsed && showCollapseToggle && 'md:hidden')}>
            <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]',
                  pathname === '/settings' || pathname?.startsWith('/settings')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Settings className="h-5 w-5 shrink-0" />
                Settings
              </Link>
          </div>
        </div>

        {/* Collapse/expand arrow — tablet & desktop only, 44px touch target */}
        {showCollapseToggle && (
          <div
            className={cn(
              'hidden md:flex flex-shrink-0 items-center justify-center border-l border-border/60 bg-muted/30',
              collapsed ? 'w-14 flex-col' : 'w-12 flex-col'
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-lg"
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}



