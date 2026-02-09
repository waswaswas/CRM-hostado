'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wallet, Receipt, Upload, Users, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrencyDisplay } from '@/lib/currency-display-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { CurrencyDisplayMode } from '@/lib/currency-display'

const accountingNav = [
  { name: 'Dashboard', href: '/accounting/dashboard', icon: LayoutDashboard },
  { name: 'Customers', href: '/accounting/customers', icon: Users },
  { name: 'Transactions', href: '/accounting/transactions', icon: Receipt },
  { name: 'Accounts', href: '/accounting/accounts', icon: Wallet },
  { name: 'Import', href: '/accounting/import', icon: Upload },
]

const modeLabels: Record<CurrencyDisplayMode, string> = {
  eur: 'EUR only',
  bgn: 'BGN only',
  both: 'Both (BGN + EUR)',
}

export function AccountingNav() {
  const pathname = usePathname()
  const { mode, setMode } = useCurrencyDisplay()

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 border-b pb-4 mb-6 w-full">
      <div className="flex items-center gap-2 sm:gap-2 overflow-x-auto min-w-0 flex-1">
        {accountingNav.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 min-h-[44px] sm:min-h-0',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="text-sm sm:text-sm">{item.name}</span>
            </Link>
          )
        })}
      </div>
      <div className="flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-h-[44px] sm:min-h-0 px-3 sm:px-3">
              <Banknote className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline text-sm">{modeLabels[mode]}</span>
              <span className="sm:hidden text-sm">Currency</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setMode('eur')} className="min-h-[44px] sm:min-h-0">
              EUR only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMode('bgn')} className="min-h-[44px] sm:min-h-0">
              BGN only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMode('both')} className="min-h-[44px] sm:min-h-0">
              Both (BGN + EUR)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
















