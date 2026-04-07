'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'gradient'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'dark',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

function readInitialTheme(storageKey: string, defaultTheme: Theme): Theme {
  if (typeof window === 'undefined') return defaultTheme
  const stored = localStorage.getItem(storageKey)
  if (stored === 'light' || stored === 'dark' || stored === 'gradient') {
    return stored
  }
  if (stored === 'system') {
    const resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    localStorage.setItem(storageKey, resolved)
    return resolved
  }
  return defaultTheme
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() =>
    readInitialTheme(storageKey, defaultTheme)
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark', 'gradient')
    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}



