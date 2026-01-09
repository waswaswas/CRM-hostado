'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | undefined>(undefined)

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative">{children}</div>
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

export function DropdownMenuContent({
  children,
  align = 'start',
  className,
}: {
  children: React.ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  const context = React.useContext(DropdownMenuContext)
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu')

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

  if (!context.open) return null

  return (
    <div
      data-dropdown-menu
      className={cn(
        'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        align === 'end' ? 'right-0' : 'left-0',
        'mt-2',
        className
      )}
    >
      {children}
    </div>
  )
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

