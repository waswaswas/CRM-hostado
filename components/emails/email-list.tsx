'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Email, EmailStatus, EmailFolder } from '@/app/actions/emails'
import {
  getEmails,
  getTrashEmails,
  deleteEmail,
  markEmailAsRead,
  restoreEmail,
  permanentlyDeleteEmail,
  checkForNewEmails,
} from '@/app/actions/emails'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toaster'
import { format } from 'date-fns'
import Link from 'next/link'
import { Mail, Trash2, Eye, Send, Clock, XCircle, CheckCircle, FileText, Reply, Forward, MailOpen, Archive, RefreshCw } from 'lucide-react'

interface EmailListProps {
  initialEmails?: Email[]
  clientId?: string
}

export function EmailList({ initialEmails = [], clientId }: EmailListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [emails, setEmails] = useState<Email[]>(initialEmails)
  const [folderFilter, setFolderFilter] = useState<EmailFolder | 'all'>('sent')
  const [loading, setLoading] = useState(false)
  const [checkingEmails, setCheckingEmails] = useState(false)

  const loadEmails = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
    }
    try {
      let data: Email[]
      if (folderFilter === 'trash') {
        data = await getTrashEmails()
      } else {
        data = await getEmails({
          client_id: clientId,
          folder: folderFilter !== 'all' ? folderFilter : undefined,
        })
      }
      
      setEmails((prevEmails) => {
        // Check if there are new emails (compare by ID)
        const previousEmailIds = new Set(prevEmails.map(e => e.id))
        const newEmails = data.filter(e => !previousEmailIds.has(e.id))
        
        // Show notification if new emails found (only for auto-refresh, not initial load)
        if (silent && newEmails.length > 0 && prevEmails.length > 0) {
          toast({
            title: 'New Emails',
            description: `${newEmails.length} new email${newEmails.length > 1 ? 's' : ''} received`,
          })
        }
        
        return data
      })
    } catch (error) {
      console.error('Failed to load emails:', error)
      if (!silent) {
        toast({
          title: 'Error',
          description: 'Failed to load emails',
          variant: 'destructive',
        })
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [folderFilter, clientId, toast])

  useEffect(() => {
    loadEmails()
  }, [loadEmails])

  // Auto-refresh emails every 60 seconds (silent refresh)
  useEffect(() => {
    // Only start auto-refresh after initial load
    if (emails.length === 0) return

    const interval = setInterval(() => {
      loadEmails(true) // Silent refresh - no loading indicator
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [loadEmails, emails.length])

  async function handleDelete(emailId: string) {
    if (!confirm('Are you sure you want to move this email to trash?')) {
      return
    }

    try {
      await deleteEmail(emailId)
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
      toast({
        title: 'Success',
        description: 'Email moved to trash',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete email',
        variant: 'destructive',
      })
    }
  }

  async function handleCheckForEmails() {
    setCheckingEmails(true)
    try {
      const result = await checkForNewEmails()
      if (result.success) {
        if (result.processed > 0) {
          toast({
            title: 'Success',
            description: `Found and processed ${result.processed} new email${result.processed > 1 ? 's' : ''}`,
          })
          // Reload emails to show new ones
          await loadEmails()
        } else {
          toast({
            title: 'No New Emails',
            description: 'No new emails found in your inbox',
          })
        }
      } else {
        toast({
          title: 'Error',
          description: result.errors.join(', ') || 'Failed to check for emails',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to check for emails:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check for emails',
        variant: 'destructive',
      })
    } finally {
      setCheckingEmails(false)
    }
  }

  async function handlePermanentlyDelete(emailId: string) {
    if (!confirm('Are you sure you want to permanently delete this email? This action cannot be undone.')) {
      return
    }

    try {
      await permanentlyDeleteEmail(emailId)
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
      toast({
        title: 'Success',
        description: 'Email permanently deleted',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete email',
        variant: 'destructive',
      })
    }
  }

  async function handleRestore(emailId: string) {
    try {
      await restoreEmail(emailId)
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
      toast({
        title: 'Success',
        description: 'Email restored',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to restore email',
        variant: 'destructive',
      })
    }
  }

  async function handleMarkAsRead(emailId: string, isRead: boolean) {
    try {
      await markEmailAsRead(emailId, isRead)
      setEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, is_read: isRead } : e))
      )
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
        <div className="flex items-center gap-2">
          <Link href="/emails/templates">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Templates
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleCheckForEmails}
            disabled={checkingEmails}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checkingEmails ? 'animate-spin' : ''}`} />
            {checkingEmails ? 'Checking...' : 'Check for Emails'}
          </Button>
          <Link href="/emails/receive">
            <Button variant="outline">
              <Mail className="mr-2 h-4 w-4" />
              Add Received
            </Button>
          </Link>
          <Link href="/emails/compose">
            <Button>
              <Mail className="mr-2 h-4 w-4" />
              Compose
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Folder</label>
          <Select
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value as EmailFolder | 'all')}
            className="mt-1"
          >
            <option value="all">All</option>
            <option value="inbox">Inbox</option>
            <option value="sent">Sent</option>
            <option value="draft">Draft</option>
            <option value="trash">Trash</option>
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
            <Card
              key={email.id}
              className={`transition-colors hover:bg-accent ${!email.is_read ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {!email.is_read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      )}
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
                      {email.direction === 'inbound' ? (
                        <>
                          <span>From: {email.from_email}</span>
                          {email.from_name && <span> ({email.from_name})</span>}
                        </>
                      ) : (
                        <>
                          <span>To: {email.to_email}</span>
                          {email.to_name && <span> ({email.to_name})</span>}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>Created: {format(new Date(email.created_at), 'MMM d, yyyy HH:mm')}</span>
                      {email.sent_at && (
                        <span> • Sent: {format(new Date(email.sent_at), 'MMM d, yyyy HH:mm')}</span>
                      )}
                      {email.scheduled_at && (
                        <span> • Scheduled: {format(new Date(email.scheduled_at), 'MMM d, yyyy HH:mm')}</span>
                      )}
                      {email.deleted_at && (
                        <span> • Deleted: {format(new Date(email.deleted_at), 'MMM d, yyyy HH:mm')}</span>
                      )}
                    </div>
                    {email.error_message && (
                      <div className="mt-2 text-sm text-red-600">
                        Error: {email.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {folderFilter !== 'trash' && (
                      <>
                        {email.status === 'sent' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/emails/${email.id}/reply`)}
                              title="Reply"
                            >
                              <Reply className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/emails/${email.id}/forward`)}
                              title="Forward"
                            >
                              <Forward className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(email.id, !email.is_read)}
                          title={email.is_read ? 'Mark as unread' : 'Mark as read'}
                        >
                          {email.is_read ? (
                            <MailOpen className="h-4 w-4" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                    <Link href={`/emails/${email.id}`}>
                      <Button variant="ghost" size="sm" title="View">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    {folderFilter === 'trash' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(email.id)}
                          title="Restore"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePermanentlyDelete(email.id)}
                          title="Permanently delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(email.id)}
                        title="Move to trash"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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









