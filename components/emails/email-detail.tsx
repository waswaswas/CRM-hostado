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
import { ArrowLeft, Send, Trash2, Mail, Reply, Forward, MailOpen } from 'lucide-react'
import Link from 'next/link'
import { markEmailAsRead } from '@/app/actions/emails'

interface EmailDetailProps {
  initialEmail: Email
}

export function EmailDetail({ initialEmail }: EmailDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState<Email>(initialEmail)
  const [loading, setLoading] = useState(false)

  // Mark email as read when viewed
  useEffect(() => {
    if (!email.is_read && email.direction === 'inbound') {
      markEmailAsRead(email.id, true).then((updated) => {
        setEmail(updated)
      }).catch(console.error)
    }
  }, [email.id, email.is_read, email.direction])

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
    if (!confirm('Are you sure you want to move this email to trash?')) {
      return
    }

    try {
      await deleteEmail(email.id)
      toast({
        title: 'Success',
        description: 'Email moved to trash',
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

  async function handleMarkAsRead(isRead: boolean) {
    try {
      const updated = await markEmailAsRead(email.id, isRead)
      setEmail(updated)
      toast({
        title: 'Success',
        description: isRead ? 'Email marked as read' : 'Email marked as unread',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update email',
        variant: 'destructive',
      })
    }
  }

  function getStatusColor(status: Email['status'], direction?: string) {
    // For inbound emails, show "Received" in light blue
    if (direction === 'inbound') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
    
    // For outbound emails, use status-based colors
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

  function getStatusLabel(status: Email['status'], direction?: string) {
    // For inbound emails, always show "Received"
    if (direction === 'inbound') {
      return 'Received'
    }
    
    // For outbound emails, show status (sent/failed/etc.)
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Button variant="ghost" onClick={() => router.back()} className="min-h-[44px] min-w-[44px] md:h-9 md:w-auto flex-shrink-0">
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{email.subject}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={getStatusColor(email.status, email.direction || undefined)}>
            {getStatusLabel(email.status, email.direction || undefined)}
          </Badge>
          {email.status === 'sent' && email.direction === 'outbound' && (
            <>
              <Button
                variant="outline"
                onClick={() => router.push(`/emails/${email.id}/reply`)}
                disabled={loading}
                className="min-h-[44px] md:h-9"
              >
                <Reply className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Reply</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/emails/${email.id}/forward`)}
                disabled={loading}
                className="min-h-[44px] md:h-9"
              >
                <Forward className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Forward</span>
              </Button>
            </>
          )}
          {email.direction === 'inbound' && (
            <Button
              variant="outline"
              onClick={() => handleMarkAsRead(!email.is_read)}
              disabled={loading}
              className="min-h-[44px] md:h-9"
            >
              {email.is_read ? (
                <>
                  <MailOpen className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Mark as Unread</span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Mark as Read</span>
                </>
              )}
            </Button>
          )}
          {email.status === 'draft' && (
            <Button onClick={handleSend} disabled={loading} className="min-h-[44px] md:h-9">
              <Send className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Send Now</span>
              <span className="sm:hidden">Send</span>
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete} disabled={loading} className="min-h-[44px] md:h-9">
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Email Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {email.direction === 'inbound' ? 'From' : 'From'}
            </label>
            <p className="mt-1 text-sm break-words">
              {email.from_name} &lt;{email.from_email}&gt;
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              {email.direction === 'inbound' ? 'To' : 'To'}
            </label>
            <p className="mt-1 text-sm break-words">
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
              className="mt-1 p-3 sm:p-4 border rounded-lg bg-white dark:bg-transparent email-body-preview max-h-[600px] overflow-y-auto"
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





























