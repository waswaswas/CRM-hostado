'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { validateAdminCode } from '@/app/actions/admin'
import { useToast } from '@/components/ui/toaster'
import { ShieldCheck } from 'lucide-react'

export function AdminCenterLogin() {
  const router = useRouter()
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await validateAdminCode(code)
      if ('success' in res) {
        router.push('/admincenter/dashboard')
        router.refresh()
      } else {
        toast({
          title: 'Invalid code',
          description: res.error,
          variant: 'destructive',
        })
        setLoading(false)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <div>
            <CardTitle>Admin Center</CardTitle>
            <CardDescription>Enter the access code to continue</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="admin-code" className="text-sm font-medium">
              Access code
            </label>
            <Input
              id="admin-code"
              type="text"
              placeholder="Enter code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono tracking-wider"
              disabled={loading}
              autoComplete="one-time-code"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
