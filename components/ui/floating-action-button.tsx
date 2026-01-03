'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, User, FileText, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FloatingActionButtonProps {
  currentPath?: string
}

export function FloatingActionButton({ currentPath }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const currentPathToUse = currentPath || pathname

  // Hide FAB on certain pages
  const hideOnPaths = ['/login', '/signup', '/setup']
  const shouldHide = currentPathToUse && hideOnPaths.some(path => currentPathToUse.startsWith(path))

  useEffect(() => {
    // Close menu when clicking outside
    if (isOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('[data-fab]')) {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const quickActions = [
    { href: '/clients/new', icon: User, label: 'New Client' },
    { href: '/offers/new', icon: FileText, label: 'New Offer' },
    { href: '/emails/compose', icon: Mail, label: 'New Email' },
  ]

  if (shouldHide) return null

  return (
    <>
      {/* Overlay when menu is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <div className="relative z-50 md:hidden" data-fab>
        {/* Quick Action Buttons - Expand downward from top */}
        <div
          className={cn(
            'absolute top-16 right-0 flex flex-col gap-3 transition-all duration-300',
            isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          )}
        >
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 bg-primary text-primary-foreground rounded-full px-4 py-3 shadow-lg min-h-[56px] min-w-[140px]"
            >
              <action.icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* Main FAB Button - Top Right */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="lg"
          className="h-12 w-12 rounded-full shadow-lg p-0 min-h-[48px] min-w-[48px]"
          aria-label={isOpen ? 'Close menu' : 'Open quick actions'}
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </Button>
      </div>
    </>
  )
}
