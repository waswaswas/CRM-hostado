'use client'

import { useState, useEffect } from 'react'
import { Email, EmailStatus } from '@/app/actions/emails'
import { getEmails, deleteEmail } from '@/app/actions/emails'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toaster'
import { format } from 'date-fns'
import Link from 'next/link'
import { Mail, Trash2, Eye, Send, Clock, XCircle, CheckCircle } from 'lucide-react'

interface EmailListProps {
  initialEmails?: Email[]
  clientId?: string
}

export function EmailList({ initialEmails = [], clientId }: EmailListProps) {
  const { toast } = useToast()
  const [emails, setEmails] = useState<Email[]>(initialEmails)
  const [statusFilter, setStatusFilter] = useState<EmailStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadEmails()
  }, [statusFilter, clientId])

  async function loadEmails() {
    setLoading(true)
    try {
      const data = await getEmails({
        client_id: clientId,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      setEmails(data)
    } catch (error) {
      console.error('Failed to load emails:', error)
      toast({
        title: 'Error',
        description: 'Failed to load emails',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(emailId: string) {
    if (!confirm('Are you sure you want to delete this email?')) {
      return
    }

    try {
      await deleteEmail(emailId)
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
      toast({
        title: 'Success',
        description: 'Email deleted successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete email',
        variant: 'destructive',
      })
    }
  }

  function getStatusIcon(status: EmailStatus) {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'sending':
        return <Send className="h-4 w-4 text-yellow-600" />
      case 'failed':
      case 'bounced':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Mail className="h-4 w-4 text-gray-600" />
    }
  }

  function getStatusColor(status: EmailStatus) {
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
        <h1 className="text-3xl font-bold">Emails</h1>
        <Link href="/emails/compose">
          <Button>
            <Mail className="mr-2 h-4 w-4" />
            Compose
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Filter by Status</label>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EmailStatus | 'all')}
            className="mt-1"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sending">Sending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="bounced">Bounced</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading emails...</div>
      ) : emails.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No emails found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {emails.map((email) => (
            <Card key={email.id} className="transition-colors hover:bg-accent">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link href={`/emails/${email.id}`} className="font-semibold hover:underline">
                        {email.subject}
                      </Link>
                      <Badge className={getStatusColor(email.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(email.status)}
                          {email.status}
                        </span>
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      <span>To: {email.to_email}</span>
                      {email.to_name && <span> ({email.to_name})</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>Created: {format(new Date(email.created_at), 'MMM d, yyyy HH:mm')}</span>
                      {email.sent_at && (
                        <span> • Sent: {format(new Date(email.sent_at), 'MMM d, yyyy HH:mm')}</span>
                      )}
                      {email.scheduled_at && (
                        <span> • Scheduled: {format(new Date(email.scheduled_at), 'MMM d, yyyy HH:mm')}</span>
                      )}
                    </div>
                    {email.error_message && (
                      <div className="mt-2 text-sm text-red-600">
                        Error: {email.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/emails/${email.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(email.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


