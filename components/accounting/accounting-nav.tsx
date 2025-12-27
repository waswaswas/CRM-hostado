'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Wallet, Receipt, LayoutDashboard, Upload, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const accountingNav = [
  { name: 'Dashboard', href: '/accounting/dashboard', icon: LayoutDashboard },
  { name: 'Customers', href: '/accounting/customers', icon: Users },
  { name: 'Transactions', href: '/accounting/transactions', icon: Receipt },
  { name: 'Accounts', href: '/accounting/accounts', icon: Wallet },
  { name: 'Import', href: '/accounting/import', icon: Upload },
]

export function AccountingNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-2 border-b pb-4 mb-6">
      {accountingNav.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        )
      })}
    </div>
  )
}
