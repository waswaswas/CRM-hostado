import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

function checkEnvVar(name: string): { exists: boolean; value: string } {
  const value = process.env[name] || ''
  return {
    exists: !!value && !value.includes('placeholder'),
    value: value ? (value.length > 20 ? value.substring(0, 20) + '...' : value) : 'Not set',
  }
}

export default function SetupPage() {
  const supabaseUrl = checkEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseKey = checkEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  const isConfigured = supabaseUrl.exists && supabaseKey.exists

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConfigured ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Supabase Configuration
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-yellow-600" />
                Setup Required
              </>
            )}
          </CardTitle>
          <CardDescription>
            {isConfigured
              ? 'Your Supabase configuration looks good!'
              : 'Please configure Supabase to use this application.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {supabaseUrl.exists ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">NEXT_PUBLIC_SUPABASE_URL</p>
                  <p className="text-sm text-muted-foreground">{supabaseUrl.value}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {supabaseKey.exists ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
                  <p className="text-sm text-muted-foreground">{supabaseKey.value}</p>
                </div>
              </div>
            </div>
          </div>

          {!isConfigured && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
              <h3 className="font-semibold mb-2">Setup Instructions:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Create a project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">supabase.com</a></li>
                <li>Go to Project Settings → API</li>
                <li>Copy your Project URL and anon/public key</li>
                <li>Create a <code className="bg-muted px-1 rounded">.env.local</code> file in the project root</li>
                <li>Add the following:
                  <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key`}
                  </pre>
                </li>
                <li>Run the SQL from <code className="bg-muted px-1 rounded">supabase/schema.sql</code> in Supabase SQL Editor</li>
                <li>Restart the development server</li>
              </ol>
            </div>
          )}

          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="outline">Go to Login</Button>
            </Link>
            {isConfigured && (
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}



