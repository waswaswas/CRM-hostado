'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, User, FileText, Mail, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FloatingActionButtonProps {
  currentPath?: string
}

export function FloatingActionButton({ currentPath }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const fabRef = useRef<HTMLDivElement>(null)
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

  // Update position when menu opens (for mobile portal) - useLayoutEffect for accurate positioning before paint
  useLayoutEffect(() => {
    if (!isOpen || !fabRef.current) return
    const rect = fabRef.current.getBoundingClientRect()
    setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
  }, [isOpen])

  const quickActions = [
    { href: '/clients/new', icon: User, label: 'New Client' },
    { href: '/offers/new', icon: FileText, label: 'New Offer' },
    { href: '/emails/compose', icon: Mail, label: 'New Email' },
    { href: '/dashboard', icon: Bell, label: 'Add Reminder' },
  ]

  if (shouldHide) return null

  const quickActionButton = (action: (typeof quickActions)[0]) => (
    <Link
      key={action.href}
      href={action.href}
      onClick={() => setIsOpen(false)}
      className="flex items-center gap-3 bg-primary text-primary-foreground rounded-full px-5 py-4 shadow-lg min-h-[56px] w-[180px] justify-start whitespace-nowrap"
    >
      <action.icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium">{action.label}</span>
    </Link>
  )

  return (
    <>
      {/* Overlay when menu is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Mobile FAB - Top Right */}
      <div className="relative z-50 md:hidden" data-fab ref={fabRef}>
        {/* Quick Action Buttons - Rendered in portal to avoid clipping */}
        {typeof document !== 'undefined' && isOpen && createPortal(
          <div
            className="fixed z-[9999] flex flex-col gap-3 transition-all duration-300"
            style={{ top: position.top, right: position.right }}
            data-fab
          >
            {quickActions.map(quickActionButton)}
          </div>,
          document.body
        )}

        {/* Main FAB Button - Top Right (Mobile) */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="lg"
          className="h-11 w-11 rounded-full shadow-lg p-0 min-h-[44px] min-w-[44px]"
          aria-label={isOpen ? 'Close menu' : 'Open quick actions'}
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Desktop FAB - Bottom Right */}
      <div className="hidden md:block fixed bottom-6 right-6 z-50" data-fab>
        {/* Quick Action Buttons - Expand upward from bottom */}
        <div
          className={cn(
            'absolute bottom-16 right-0 flex flex-col-reverse gap-3 transition-all duration-300',
            isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          )}
        >
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 bg-primary text-primary-foreground rounded-full px-5 py-3 shadow-lg min-h-[56px] w-[180px] justify-start whitespace-nowrap"
            >
              <action.icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* Main FAB Button - Bottom Right (Desktop) */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg p-0"
          aria-label={isOpen ? 'Close menu' : 'Open quick actions'}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
        </Button>
      </div>
    </>
  )
}

