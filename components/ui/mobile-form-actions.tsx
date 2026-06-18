'use client'

import { cn } from '@/lib/utils'

type MobileFormActionsProps = {
  children: React.ReactNode
  className?: string
  /** Tailwind breakpoint below which the sticky bar is shown (default: md) */
  showBelow?: 'md' | 'lg'
}

export function MobileFormActions({
  children,
  className,
  showBelow = 'md',
}: MobileFormActionsProps) {
  const visibility = showBelow === 'lg' ? 'lg:hidden' : 'md:hidden'

  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-4 mt-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        visibility,
        className
      )}
    >
      {children}
    </div>
  )
}

export function MobileFormActionsBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3', className)}>
      {children}
    </div>
  )
}
