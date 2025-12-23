'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Email } from '@/app/actions/emails'
import { getEmail, sendEmailNow, deleteEmail } from '@/app/actions/emails'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toaster'
import { format } from 'date-fns'
import { ArrowLeft, Send, Trash2, Mail } from 'lucide-react'
import Link from 'next/link'

interface EmailDetailProps {
  initialEmail: Email
}

export function EmailDetail({ initialEmail }: EmailDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState<Email>(initialEmail)
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    if (email.status === 'sent') {
      toast({
        title: 'Error',
        description: 'Email already sent',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const updated = await sendEmailNow(email.id)
      setEmail(updated)
      toast({
        title: 'Success',
        description: 'Email sent successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this email?')) {
      return
    }

    try {
      await deleteEmail(email.id)
      toast({
        title: 'Success',
        description: 'Email deleted successfully',
      })
      router.push('/emails')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete email',
        variant: 'destructive',
      })
    }
  }

  function getStatusColor(status: Email['status']) {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'sending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'failed':
      case 'bounced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">{email.subject}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(email.status)}>{email.status}</Badge>
          {email.status === 'draft' && (
            <Button onClick={handleSend} disabled={loading}>
              <Send className="h-4 w-4 mr-2" />
              Send Now
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">From</label>
            <p className="mt-1">
              {email.from_name} &lt;{email.from_email}&gt;
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">To</label>
            <p className="mt-1">
              {email.to_name ? `${email.to_name} ` : ''}&lt;{email.to_email}&gt;
            </p>
          </div>

          {email.cc_emails && email.cc_emails.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">CC</label>
              <p className="mt-1">{email.cc_emails.join(', ')}</p>
            </div>
          )}

          {email.bcc_emails && email.bcc_emails.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">BCC</label>
              <p className="mt-1">{email.bcc_emails.join(', ')}</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground">Subject</label>
            <p className="mt-1">{email.subject}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Body</label>
            <div
              className="mt-1 p-4 border rounded-lg bg-white dark:bg-gray-900 email-body-preview"
              dangerouslySetInnerHTML={{ __html: email.body_html }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="mt-1 text-sm">
                {format(new Date(email.created_at), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
            {email.sent_at && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Sent</label>
                <p className="mt-1 text-sm">
                  {format(new Date(email.sent_at), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            )}
            {email.scheduled_at && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Scheduled</label>
                <p className="mt-1 text-sm">
                  {format(new Date(email.scheduled_at), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            )}
          </div>

          {email.error_message && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-800 mt-1">{email.error_message}</p>
            </div>
          )}

          <div className="pt-4">
            <Link href={`/clients/${email.client_id}`}>
              <Button variant="outline">
                View Client
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}







