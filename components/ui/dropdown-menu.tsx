'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLDivElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | undefined>(undefined)

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement | null>(null)

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div ref={triggerRef} className="relative">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

export function DropdownMenuTrigger({
  asChild,
  children,
  className,
}: {
  asChild?: boolean
  children: React.ReactNode
  className?: string
}) {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu')

  const handleClick = () => {
    context.setOpen(!context.open)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      className: cn(className, (children.props as { className?: string }).className),
    } as any)
  }

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  )
}

const MOBILE_BREAKPOINT = 640

export function DropdownMenuContent({
  children,
  align = 'start',
  side = 'bottom',
  className,
  mobileInset: mobileInsetProp = false,
}: {
  children: React.ReactNode
  align?: 'start' | 'end'
  side?: 'top' | 'bottom'
  className?: string
  /** When true, on viewport &lt; 640px the panel is inset (left/right 1rem) so it never overflows. Use for notification panel etc. */
  mobileInset?: boolean
}) {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu')
  const [position, setPosition] = React.useState({ top: 0, left: 0, right: 0, bottom: 0 })
  const [isNarrow, setIsNarrow] = React.useState(false)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (context.open) {
        const target = event.target as HTMLElement
        if (!target.closest('[data-dropdown-menu]')) {
          context.setOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [context])

  React.useLayoutEffect(() => {
    if (mobileInsetProp && typeof window !== 'undefined') {
      setIsNarrow(window.innerWidth < MOBILE_BREAKPOINT)
    }
  }, [context.open, mobileInsetProp])

  React.useLayoutEffect(() => {
    if (!context.open || !context.triggerRef.current || typeof document === 'undefined') return
    const rect = context.triggerRef.current.getBoundingClientRect()
    const GAP = 4
    setPosition({
      top: rect.bottom + GAP,
      bottom: window.innerHeight - rect.top + GAP,
      left: rect.left,
      right: window.innerWidth - rect.right,
    })
  }, [context.open, align, side])

  React.useEffect(() => {
    if (!mobileInsetProp || typeof window === 'undefined') return
    const onResize = () => setIsNarrow(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mobileInsetProp])

  if (!context.open) return null

  const useInset = mobileInsetProp && isNarrow

  const content = (
    <div
      data-dropdown-menu
      className={cn(
        'fixed z-[9999] min-w-[8rem] overflow-visible rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        useInset && '!left-4 !right-4 !w-[calc(100vw-2rem)]',
        className
      )}
      style={
        useInset
          ? {
              ...(side === 'bottom' ? { top: position.top } : { bottom: position.bottom }),
              left: '1rem',
              right: '1rem',
              width: 'calc(100vw - 2rem)',
            }
          : {
              ...(side === 'bottom' ? { top: position.top } : { bottom: position.bottom }),
              ...(align === 'start' ? { left: position.left } : { right: position.right }),
            }
      }
    >
      {children}
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }
  return content
}

export function DropdownMenuItem({
  children,
  className,
  asChild,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  asChild?: boolean
  onClick?: () => void
}) {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuItem must be used within DropdownMenu')

  const handleClick = () => {
    onClick?.()
    context.setOpen(false)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      className: cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
        (children.props as { className?: string }).className
      ),
    } as any)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
    >
      {children}
    </div>
  )
}

export function DropdownMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-2 py-1.5 text-sm font-semibold', className)}>
      {children}
    </div>
  )
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('-mx-1 my-1 h-px bg-muted', className)} />
}

