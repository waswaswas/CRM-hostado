'use client'

import { useEffect } from 'react'

/** Force flat dark theme on offer checkout; restore on unmount. */
export function OfferCheckoutTheme({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    const prev = root.className
    root.classList.remove('gradient', 'light')
    root.classList.add('dark')
    return () => {
      root.className = prev
    }
  }, [])

  return <div className="min-h-screen bg-background text-foreground">{children}</div>
}
