'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChevronDown, Search } from 'lucide-react'
export type OfferClientOption = {
  id: string
  name: string
  company: string | null
}

export function ClientCombobox({
  clients,
  value,
  onChange,
  disabled,
  required,
  id = 'client_id',
}: {
  clients: OfferClientOption[]
  value: string
  onChange: (clientId: string) => void
  disabled?: boolean
  required?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => clients.find((c) => c.id === value) || null,
    [clients, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
    )
  }, [clients, query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function labelFor(c: OfferClientOption) {
    return `${c.name}${c.company ? ` (${c.company})` : ''}`
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Native required hook for form validation */}
      <input
        id={id}
        name={id}
        value={value}
        required={required}
        readOnly
        tabIndex={-1}
        className="sr-only"
        aria-hidden
      />
      <button
        type="button"
        disabled={disabled || clients.length === 0}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>
          {clients.length === 0
            ? 'No clients available'
            : selected
              ? labelFor(selected)
              : 'Select a client'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && clients.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients…"
              className="h-8 border-0 shadow-none focus-visible:ring-0 px-0"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.id === value}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                      c.id === value && 'bg-accent/60'
                    )}
                    onClick={() => {
                      onChange(c.id)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    {labelFor(c)}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
