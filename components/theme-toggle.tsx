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
  const resolved = theme === 'system' ? 'light' : theme

  return (
    <div data-theme-trigger-wrapper className="contents">
      <DropdownMenu>
        <DropdownMenuTrigger
          data-theme-trigger
          className={cn(
            'relative inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium',
            'hover:bg-accent hover:text-accent-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 [.gradient_&]:-rotate-90 [.gradient_&]:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 [.gradient_&]:rotate-90 [.gradient_&]:scale-0" />
        <Palette className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all [.gradient_&]:rotate-0 [.gradient_&]:scale-100" />
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
              {resolved === t.value && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="flex items-center gap-2"
        >
          <span className="text-muted-foreground text-xs">System</span>
          {theme === 'system' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  )
}
