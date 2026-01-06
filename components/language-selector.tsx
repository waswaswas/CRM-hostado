'use client'

import { useState } from 'react'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/context'
import type { Language } from '@/lib/i18n/translations'

const languages: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
]

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n()
  const [open, setOpen] = useState(false)

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title={t.settings.selectTimezone}
        className="h-9 px-2 gap-1.5"
      >
        <Languages className="h-4 w-4" />
        <span className="text-xs font-medium">
          {languages.find(l => l.code === language)?.nativeName || 'EN'}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Language / Избери език</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {languages.map((lang) => (
              <Button
                key={lang.code}
                variant={language === lang.code ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => handleLanguageChange(lang.code)}
              >
                <span className="font-medium">{lang.nativeName}</span>
                <span className="ml-2 text-sm text-muted-foreground">({lang.name})</span>
                {language === lang.code && (
                  <span className="ml-auto text-sm">✓</span>
                )}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}



































