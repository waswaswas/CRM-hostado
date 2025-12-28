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
  const [folderFilter, setFolderFilter] = useState<EmailFolder | 'all'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [loading, setLoading] = useState(false)
  const [checkingEmails, setCheckingEmails] = useState(false)

  // Sort initial emails (newest first by default)
  const sortedInitialEmails = [...initialEmails].sort((a, b) => {
    const dateA = new Date(a.sent_at || a.created_at).getTime()
    const dateB = new Date(b.sent_at || b.created_at).getTime()
    return dateB - dateA // Newest first
  })
  const [emails, setEmails] = useState<Email[]>(sortedInitialEmails)

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
        
        // Sort emails based on sortOrder
        const sortedData = [...data].sort((a, b) => {
          const dateA = new Date(a.sent_at || a.created_at).getTime()
          const dateB = new Date(b.sent_at || b.created_at).getTime()
          return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
        })
        
        return sortedData
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
  }, [folderFilter, clientId, sortOrder, toast])

  useEffect(() => {
    loadEmails()
  }, [loadEmails])

  // Sort emails when sortOrder changes
  useEffect(() => {
    setEmails((prevEmails) => {
      return [...prevEmails].sort((a, b) => {
        const dateA = new Date(a.sent_at || a.created_at).getTime()
        const dateB = new Date(b.sent_at || b.created_at).getTime()
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
      })
    })
  }, [sortOrder])

  // Auto-refresh emails every 20 seconds to catch emails within 45 seconds of arrival
  // With 20-second intervals and 5-minute search window, emails will be caught quickly
  useEffect(() => {
    // Only start auto-refresh after initial load
    if (emails.length === 0) return

    const interval = setInterval(() => {
      loadEmails(true) // Silent refresh - no loading indicator
    }, 20000) // 20 seconds - ensures emails caught within ~40-45 seconds

    return () => clearInterval(interval)
  }, [loadEmails, emails.length])
  
  // Also auto-check for new emails via IMAP every 20 seconds
  useEffect(() => {
    // Only start auto-check after initial load
    if (emails.length === 0) return

    const interval = setInterval(() => {
      // Silently check for new emails via IMAP
      checkForNewEmails()
        .then((result) => {
          if (result.success && result.processed > 0) {
            // Reload emails if new ones were found
            loadEmails(true)
          }
        })
        .catch((error) => {
          console.error('Auto-check for emails failed:', error)
        })
    }, 20000) // 20 seconds

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
    
    // Add timeout to prevent button from getting stuck
    const timeoutId = setTimeout(() => {
      setCheckingEmails(false)
      toast({
        title: 'Timeout',
        description: 'Email check is taking too long. Please try again.',
        variant: 'destructive',
      })
    }, 30000) // 30 second timeout
    
    try {
      const result = await checkForNewEmails()
      clearTimeout(timeoutId)
      
      if (result.success) {
        if (result.processed > 0) {
          toast({
            title: 'Success',
            description: `Found and processed ${result.processed} new email${result.processed > 1 ? 's' : ''}`,
          })
          // Reload emails to show the new ones
          await loadEmails(false)
        } else {
          toast({
            title: 'No New Emails',
            description: 'No new emails found',
          })
          // Still reload to make sure we have the latest
          await loadEmails(true)
        }
      } else {
        toast({
          title: 'Error',
          description: result.errors.length > 0 ? result.errors.join(', ') : 'Failed to check for emails',
          variant: 'destructive',
        })
      }
    } catch (error) {
      clearTimeout(timeoutId)
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

  function getStatusIcon(status: EmailStatus, direction?: string) {
    // For inbound emails, use mail icon
    if (direction === 'inbound') {
      return <Mail className="h-3 w-3" />
    }
    
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-3 w-3" />
      case 'scheduled':
        return <Clock className="h-3 w-3" />
      case 'sending':
        return <Send className="h-3 w-3" />
      case 'failed':
      case 'bounced':
        return <XCircle className="h-3 w-3" />
      default:
        return <Mail className="h-3 w-3" />
    }
  }

  function getStatusColor(status: EmailStatus, direction?: string) {
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

  function getStatusOnlyColor(status: EmailStatus) {
    // Color for the status badge (second badge for outbound emails)
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

  function getStatusLabel(status: EmailStatus, direction?: string) {
    // For inbound emails, always show "Received"
    if (direction === 'inbound') {
      return 'Received'
    }
    
    // For outbound emails, show status (Sent/Failed/etc.)
    return status.charAt(0).toUpperCase() + status.slice(1)
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
        <div>
          <label className="text-sm font-medium">Sort</label>
          <Select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="mt-1"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
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
                      {/* Direction/Type Badge */}
                      <Badge className={getStatusColor(email.status, email.direction)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(email.status, email.direction)}
                          {getStatusLabel(email.status, email.direction)}
                        </span>
                      </Badge>
                      {/* Status Badge (only for outbound emails) */}
                      {email.direction === 'outbound' && (
                        <Badge className={getStatusOnlyColor(email.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(email.status)}
                            {email.status}
                          </span>
                        </Badge>
                      )}
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
                        {(email.status === 'sent' || email.direction === 'inbound') && (
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
















