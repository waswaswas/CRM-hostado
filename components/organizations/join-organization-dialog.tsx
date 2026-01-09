'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { CheckCircle, XCircle, Users } from 'lucide-react'
import { joinOrganizationByCode, validateInvitationCode } from '@/app/actions/organizations'
import { useToast } from '@/components/ui/toaster'

interface JoinOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JoinOrganizationDialog({ open, onOpenChange }: JoinOrganizationDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [invitationCode, setInvitationCode] = useState('')
  const [validating, setValidating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [codeValidation, setCodeValidation] = useState<{
    valid: boolean
    organizationName?: string
    expiresAt?: string
    error?: string
  } | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null)

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
        setTimeRemaining(null)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to validate code',
        variant: 'destructive',
      })
      setTimeRemaining(null)
    } finally {
      setValidating(false)
    }
  }

  // Update time remaining every second
  useEffect(() => {
    if (!codeValidation?.valid || !codeValidation.expiresAt) {
      setTimeRemaining(null)
      return
    }

    const updateTimeRemaining = () => {
      const expirationDate = new Date(codeValidation.expiresAt!)
      const now = new Date()
      const diff = expirationDate.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining(null)
        setCodeValidation({ ...codeValidation, valid: false, error: 'Invitation code has expired' })
        return
      }

      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }

    updateTimeRemaining()
    const interval = setInterval(updateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [codeValidation])

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
      // Reset form
      setInvitationCode('')
      setCodeValidation(null)
      onOpenChange(false)
      router.refresh()
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

  const handleClose = () => {
    setInvitationCode('')
    setCodeValidation(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogClose onClose={handleClose} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Organization
          </DialogTitle>
          <DialogDescription>
            Enter the invitation code you received to join an organization
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && invitationCode.trim()) {
                  if (codeValidation?.valid) {
                    handleJoinOrganization()
                  } else {
                    handleValidateCode()
                  }
                }
              }}
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
                        {timeRemaining && (
                          <span className="block text-xs mt-1">
                            Expires in: {timeRemaining}
                          </span>
                        )}
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
