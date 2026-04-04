'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Users, FileText, Mail, Building2, ListTodo, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useFeaturePermissions, type Feature } from '@/lib/hooks/use-feature-permissions'
import { useOrganization } from '@/lib/organization-context'

type BottomNavItem =
  | { name: string; href: string; icon: LucideIcon; feature: Feature; badge?: string }
  | { name: string; href: string; icon: LucideIcon; assistantsOnly: true }

const navigation: BottomNavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, feature: 'dashboard' },
  { name: 'Clients', href: '/clients', icon: Users, feature: 'clients' },
  { name: 'Offers', href: '/offers', icon: FileText, feature: 'offers' },
  { name: 'Emails', href: '/emails', icon: Mail, feature: 'emails' },
  { name: 'Accounting', href: '/accounting', icon: Building2, badge: 'Beta', feature: 'accounting' },
  { name: 'To-Do List', href: '/todo', icon: ListTodo, feature: 'todo' },
  { name: 'AI', href: '/assistants', icon: Sparkles, assistantsOnly: true },
]

export function BottomNav() {
  const pathname = usePathname()
  const { permissions, loading, assistantsCanOpen } = useFeaturePermissions()
  const { isLoading: orgLoading } = useOrganization()

  const navLoading = orgLoading || loading

  const filtered = navigation.filter((item) => {
    if ('assistantsOnly' in item && item.assistantsOnly) {
      if (navLoading && assistantsCanOpen !== true) return false
      return assistantsCanOpen === true
    }
    if (!('feature' in item)) return false
    const feature = item.feature
    if (navLoading && permissions[feature] !== true) {
      return false
    }
    return permissions[feature] === true
  })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex h-16 items-center justify-around">
        {filtered.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0 px-2 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <item.icon className={cn('h-6 w-6', isActive && 'text-primary')} />
                {'badge' in item && item.badge && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-2 -right-2 h-4 px-1 text-[10px]"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn('text-xs truncate w-full text-center', isActive && 'font-medium')}>
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

