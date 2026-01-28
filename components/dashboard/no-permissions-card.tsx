'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function NoPermissionsCard() {
  const router = useRouter()

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="flex-shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/50 p-3">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-1">
              No permissions assigned
            </h2>
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
              You don’t have access to any features in this organization. Please contact your organization administrator to request access. If they’ve just granted you permissions, refresh the page to see them.
            </p>
            <Button
              onClick={() => router.refresh()}
              variant="default"
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh page
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
