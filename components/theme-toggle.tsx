'use client'

import { Moon, Sun, Palette, Check } from 'lucide-react'
import { useTheme, type Theme } from './theme-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'gradient', label: 'Gradient', icon: Palette },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div data-theme-trigger-wrapper className="contents">
      <DropdownMenu>
        <DropdownMenuTrigger
          data-theme-trigger
          className={cn(
            'no-touch-target relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md text-sm font-medium sm:h-10 sm:w-10',
            'hover:bg-accent hover:text-accent-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
        <Sun className="h-[1.05rem] w-[1.05rem] shrink-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 [.gradient_&]:-rotate-90 [.gradient_&]:scale-0 sm:h-[1.2rem] sm:w-[1.2rem]" />
        <Moon className="absolute h-[1.05rem] w-[1.05rem] shrink-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 [.gradient_&]:rotate-90 [.gradient_&]:scale-0 sm:h-[1.2rem] sm:w-[1.2rem]" />
        <Palette className="absolute h-[1.05rem] w-[1.05rem] shrink-0 rotate-90 scale-0 transition-all [.gradient_&]:rotate-0 [.gradient_&]:scale-100 sm:h-[1.2rem] sm:w-[1.2rem]" />
        <span className="sr-only">Choose theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEMES.map((t) => {
          const Icon = t.icon
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {theme === t.value && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  )
}
