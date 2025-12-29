'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Template page error:', error)
  }, [error])

  const isTableError = error.message?.includes('does not exist') || 
                       error.message?.includes('relation') || 
                       error.message?.includes('SETUP_EMAILS')

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Error Loading Templates</CardTitle>
          </div>
          <CardDescription>
            {isTableError 
              ? 'The email templates table is missing'
              : 'An unexpected error occurred'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-mono text-destructive">
                {error.message}
              </p>
            </div>
          )}
          {isTableError && (
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-medium mb-2">To fix this issue:</p>
              <ol className="text-sm list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Open Supabase Dashboard</li>
                <li>Go to SQL Editor</li>
                <li>Run the file: <code className="bg-background px-1 rounded">supabase/SETUP_EMAILS.sql</code></li>
                <li>Make sure all tables are created successfully</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1">
              Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = '/dashboard')}
              className="flex-1"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}















