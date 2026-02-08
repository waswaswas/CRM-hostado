'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { CurrencyDisplayMode } from './currency-display'

const STORAGE_KEY = 'accounting_currency_display'

interface CurrencyDisplayContextType {
  mode: CurrencyDisplayMode
  setMode: (mode: CurrencyDisplayMode) => void
}

const CurrencyDisplayContext = createContext<CurrencyDisplayContextType | undefined>(undefined)

export function CurrencyDisplayProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<CurrencyDisplayMode>('both')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as CurrencyDisplayMode | null
      if (stored && ['eur', 'bgn', 'both'].includes(stored)) {
        setModeState(stored)
      }
    } catch {
      // ignore
    }
  }, [])

  const setMode = useCallback((m: CurrencyDisplayMode) => {
    setModeState(m)
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      // ignore
    }
  }, [])

  return (
    <CurrencyDisplayContext.Provider value={{ mode, setMode }}>
      {children}
    </CurrencyDisplayContext.Provider>
  )
}

const defaultMode: CurrencyDisplayMode = 'both'

export function useCurrencyDisplay() {
  const ctx = useContext(CurrencyDisplayContext)
  if (ctx === undefined) {
    return { mode: defaultMode, setMode: () => {} }
  }
  return ctx
}
