'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, FileText, Mail, Building2, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useFeaturePermissions } from '@/lib/hooks/use-feature-permissions'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, feature: 'dashboard' as const },
  { name: 'Clients', href: '/clients', icon: Users, feature: 'clients' as const },
  { name: 'Offers', href: '/offers', icon: FileText, feature: 'offers' as const },
  { name: 'Emails', href: '/emails', icon: Mail, feature: 'emails' as const },
  { name: 'Accounting', href: '/accounting', icon: Building2, badge: 'Beta', feature: 'accounting' as const },
  { name: 'To-Do List', href: '/todo', icon: ListTodo, feature: 'todo' as const },
]

export function BottomNav() {
  const pathname = usePathname()
  const { permissions, loading } = useFeaturePermissions()
  
  // Restrictive filtering: only show features with explicit permission
  // This prevents flash of all features while permissions are loading
  const filtered = navigation.filter((item) => {
    // If loading and no cached permission, don't show (restrictive default)
    if (loading && permissions[item.feature] !== true) {
      return false
    }
    // Only show if permission is explicitly true
    return permissions[item.feature] === true
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
                {item.badge && (
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

