'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-amber-600" />
            <CardTitle>Setup Required</CardTitle>
          </div>
          <CardDescription>
            Supabase is not configured. Please add your environment variables to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">Add these to your <code className="bg-background px-1 rounded">.env.local</code>:</p>
            <pre className="overflow-x-auto text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
            </pre>
          </div>
          <p className="text-sm text-muted-foreground">
            Get your keys from the Supabase Dashboard → Project Settings → API.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/login">Continue to Login</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                Open Supabase Dashboard
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
