'use client'

import * as React from "react"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const DialogTitleId = React.createContext<string | undefined>(undefined)

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const titleId = React.useId()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const changeRef = React.useRef(onOpenChange)
  changeRef.current = onOpenChange
  React.useEffect(() => {
    if (!open) return
    const trigger = document.activeElement as HTMLElement | null
    const root = rootRef.current
    const focusable = () => Array.from(root?.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex="0"]') || []).filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0)
    const frame = requestAnimationFrame(() => (root?.querySelector<HTMLElement>('[autofocus]') || focusable()[0] || root)?.focus())
    const keydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[data-dialog-root]')
      if (dialogs[dialogs.length - 1] !== root) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        changeRef.current?.(false)
      } else if (event.key === 'Tab') {
        const elements = focusable()
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (!first) { event.preventDefault(); root?.focus(); return }
        if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || !root?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', keydown)
      if (trigger?.isConnected) trigger.focus()
    }
  }, [open])
  if (!open) return null

  return (
    <div ref={rootRef} data-dialog-root tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange?.(false)}
      />
      <DialogTitleId.Provider value={titleId}>{children}</DialogTitleId.Provider>
    </div>
  )
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const titleId = React.useContext(DialogTitleId)
    return (
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={typeof props['aria-label'] === 'string' ? props['aria-label'] : undefined}
        className={cn(
          "relative z-50 grid w-full max-w-[calc(100vw-2rem)] sm:max-w-lg gap-4 border bg-popover text-popover-foreground p-4 sm:p-6 shadow-lg duration-200 rounded-lg max-h-[min(90vh,90dvh)] overflow-y-auto overflow-x-hidden",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    id={React.useContext(DialogTitleId)}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

const DialogClose = ({
  onClose,
}: {
  onClose: () => void
}) => (
  <button
    onClick={onClose}
    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
  >
    <X className="h-5 w-5 sm:h-4 sm:w-4" />
    <span className="sr-only">Close</span>
  </button>
)

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button ref={ref} className={className} {...props}>
    {children}
  </button>
))
DialogTrigger.displayName = "DialogTrigger"

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogTrigger,
}



