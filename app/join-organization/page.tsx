'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Plus, Users, ArrowRight, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { joinOrganizationByCode, validateInvitationCode } from '@/app/actions/organizations'
import { createOrganization } from '@/app/actions/organizations'
import { useToast } from '@/components/ui/toaster'

export default function JoinOrganizationPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState<'choose' | 'join' | 'create'>('choose')
  const [invitationCode, setInvitationCode] = useState('')
  const [validating, setValidating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [creating, setCreating] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [codeValidation, setCodeValidation] = useState<{
    valid: boolean
    organizationName?: string
    expiresAt?: string
    error?: string
  } | null>(null)

  async function handleValidateCode() {
    if (!invitationCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an invitation code',
        variant: 'destructive',
      })
      return
    }

    setValidating(true)
    try {
      const result = await validateInvitationCode(invitationCode.trim().toUpperCase())
      setCodeValidation(result)
      if (result.valid) {
        toast({
          title: 'Code Valid',
          description: `You can join ${result.organizationName}`,
        })
      } else {
        toast({
          title: 'Invalid Code',
          description: result.error || 'The invitation code is invalid or expired',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to validate code',
        variant: 'destructive',
      })
    } finally {
      setValidating(false)
    }
  }

  async function handleJoinOrganization() {
    if (!invitationCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an invitation code',
        variant: 'destructive',
      })
      return
    }

    setJoining(true)
    try {
      await joinOrganizationByCode(invitationCode.trim().toUpperCase())
      toast({
        title: 'Success',
        description: 'You have successfully joined the organization!',
      })
      router.push('/dashboard')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to join organization',
        variant: 'destructive',
      })
    } finally {
      setJoining(false)
    }
  }

  async function handleCreateOrganization() {
    if (!orgName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an organization name',
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    try {
      await createOrganization({
        name: orgName.trim(),
        slug: orgSlug.trim() || undefined,
      })
      toast({
        title: 'Success',
        description: 'Organization created successfully!',
      })
      router.push('/dashboard')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create organization',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  // Auto-generate slug from name
  useEffect(() => {
    if (orgName && step === 'create') {
      const slug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setOrgSlug(slug)
    }
  }, [orgName, step])

  if (step === 'choose') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <div className="mx-auto max-w-2xl w-full space-y-6">
          <h1 className="text-3xl font-bold">Welcome!</h1>

          <Card>
            <CardHeader>
              <CardTitle>Select Organization Option</CardTitle>
              <CardDescription>Choose how you'd like to get started</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setStep('join')}
                  className="group relative rounded-lg border-2 border-dashed p-6 text-left transition-all hover:border-primary hover:bg-accent"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Join Organization</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use an invitation code to join an existing organization. Perfect for team members.
                  </p>
                  <div className="mt-4 text-xs text-muted-foreground">
                    <p className="font-medium">Required: Invitation Code</p>
                    <p>You'll need an 8-character code from your organization owner</p>
                  </div>
                </button>

                <button
                  onClick={() => setStep('create')}
                  className="group relative rounded-lg border-2 border-dashed p-6 text-left transition-all hover:border-primary hover:bg-accent"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Create Organization</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Start your own organization and invite team members. For new businesses and teams.
                  </p>
                  <div className="mt-4 text-xs text-muted-foreground">
                    <p className="font-medium">Required: Organization Name</p>
                    <p>Optional: Custom slug for your organization URL</p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (step === 'join') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <div className="mx-auto max-w-md w-full space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStep('choose')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">Join Organization</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Enter Invitation Code</CardTitle>
              <CardDescription>
                Enter the invitation code you received
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Invitation Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="ABCD1234"
                value={invitationCode}
                onChange={(e) => {
                  setInvitationCode(e.target.value.toUpperCase())
                  setCodeValidation(null)
                }}
                className="text-center font-mono text-lg tracking-wider"
                maxLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Enter the 8-character code shared with you
              </p>
            </div>

            {codeValidation && (
              <div className={`p-3 rounded-lg border ${
                codeValidation.valid 
                  ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {codeValidation.valid ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Valid Code
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Join {codeValidation.organizationName}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <div>
                        <p className="font-medium text-red-900 dark:text-red-100">
                          Invalid Code
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          {codeValidation.error || 'The code is invalid or expired'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleValidateCode}
                disabled={validating || !invitationCode.trim()}
                className="flex-1"
              >
                {validating ? 'Validating...' : 'Validate Code'}
              </Button>
              <Button
                onClick={handleJoinOrganization}
                disabled={joining || !codeValidation?.valid}
                className="flex-1"
              >
                {joining ? 'Joining...' : 'Join Organization'}
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    )
  }

  if (step === 'create') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <div className="mx-auto max-w-md w-full space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStep('choose')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">Create Organization</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Set up your own organization
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                type="text"
                placeholder="My Company"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgSlug">Slug (Optional)</Label>
              <Input
                id="orgSlug"
                type="text"
                placeholder="my-company"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier (auto-generated from name if not provided)
              </p>
            </div>

            <Button
              onClick={handleCreateOrganization}
              disabled={creating || !orgName.trim()}
              className="w-full"
            >
              {creating ? 'Creating...' : 'Create Organization'}
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    )
  }

  return null
}
