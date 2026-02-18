'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, Settings } from 'lucide-react'
import Link from 'next/link'

interface EmailSetupPromptProps {
  organizationName: string
}

export function EmailSetupPrompt({ organizationName }: EmailSetupPromptProps) {
  const displayName = organizationName || 'this organization'
  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/60 p-2">
            <Mail className="h-5 w-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Configure email for {displayName}
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-0.5">
              To send and receive emails, add your SMTP (and optional IMAP) details in Organization Settings.
            </p>
          </div>
        </div>
        <Link href="/organizations" className="shrink-0">
          <Button variant="outline" className="border-amber-300 dark:border-amber-700">
            <Settings className="mr-2 h-4 w-4" />
            Open organization settings
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
