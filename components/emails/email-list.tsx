'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/lib/organization-context'

interface EmailListProps {
  initialEmails?: Email[]
  clientId?: string
}

export function EmailList({ initialEmails = [], clientId }: EmailListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { currentOrganization } = useOrganization()
  const [folderFilter, setFolderFilter] = useState<EmailFolder | 'all'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [loading, setLoading] = useState(false)
  const [checkingEmails, setCheckingEmails] = useState(false)
  const initialCheckRef = useRef(false)

  // Sort initial emails (newest first by default)
  const sortedInitialEmails = [...initialEmails].sort((a, b) => {
    const dateA = new Date(a.sent_at || a.created_at).getTime()
    const dateB = new Date(b.sent_at || b.created_at).getTime()
    return dateB - dateA // Newest first
  })
  const [emails, setEmails] = useState<Email[]>(sortedInitialEmails)
  const [newEmailsCount, setNewEmailsCount] = useState(0)

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
    if (initialCheckRef.current) {
      return
    }
    initialCheckRef.current = true
    let isMounted = true
    async function initialLoad() {
      try {
        const result = await checkForNewEmails()
        if (!isMounted) return
        if (result.success && result.processed > 0) {
          setNewEmailsCount(result.processed)
          toast({
            title: 'New Emails',
            description: `${result.processed} new email${result.processed > 1 ? 's' : ''} received`,
          })
          setNewEmailsCount(result.processed)
        }
      } catch (error) {
        console.error('Initial check for emails failed:', error)
      } finally {
        if (isMounted) {
          await loadEmails(true)
        }
      }
    }

    initialLoad()
    return () => {
      isMounted = false
    }
  }, [loadEmails, toast])

  useEffect(() => {
    if (!currentOrganization?.id) return
    const supabase = createClient()
    let isActive = true

    const channel = supabase
      .channel(`emails-${currentOrganization.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emails',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        (payload) => {
          if (!isActive) return
          const newEmail = payload.new as Email
          setEmails((prev) => {
            if (prev.some((email) => email.id === newEmail.id)) {
              return prev
            }
            setNewEmailsCount((count) => count + 1)
            toast({
              title: 'New Emails',
              description: 'New email received',
            })
            const next = [newEmail, ...prev]
            return next.sort((a, b) => {
              const dateA = new Date(a.sent_at || a.created_at).getTime()
              const dateB = new Date(b.sent_at || b.created_at).getTime()
              return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
            })
          })
        }
      )
      .subscribe()

    return () => {
      isActive = false
      supabase.removeChannel(channel)
    }
  }, [currentOrganization?.id, sortOrder, toast])

  useEffect(() => {
    if (newEmailsCount === 0) return
    const timeoutId = setTimeout(() => {
      setNewEmailsCount(0)
    }, 15000)
    return () => clearTimeout(timeoutId)
  }, [newEmailsCount])

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
          setNewEmailsCount(result.processed)
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Emails</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Link href="/emails/templates" className="flex-1 sm:flex-initial">
            <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">
              <FileText className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
              <span className="sm:hidden">Templates</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleCheckForEmails}
            disabled={checkingEmails}
            className="flex-1 sm:flex-initial min-h-[44px]"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checkingEmails ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{checkingEmails ? 'Checking...' : 'Check for Emails'}</span>
            <span className="sm:hidden">Check</span>
            {newEmailsCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {newEmailsCount}
              </span>
            )}
          </Button>
          <Link href="/emails/receive" className="flex-1 sm:flex-initial">
            <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">
              <Mail className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Received</span>
              <span className="sm:hidden">Receive</span>
            </Button>
          </Link>
          <Link href="/emails/compose" className="flex-1 sm:flex-initial">
            <Button className="w-full sm:w-auto min-h-[44px]">
              <Mail className="mr-2 h-4 w-4" />
              Compose
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 sm:flex-initial">
          <label className="text-sm font-medium">Folder</label>
          <Select
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value as EmailFolder | 'all')}
            className="mt-1 w-full sm:w-auto min-h-[44px]"
          >
            <option value="all">All</option>
            <option value="inbox">Inbox</option>
            <option value="sent">Sent</option>
            <option value="draft">Draft</option>
            <option value="trash">Trash</option>
          </Select>
        </div>
        <div className="flex-1 sm:flex-initial">
          <label className="text-sm font-medium">Sort</label>
          <Select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="mt-1 w-full sm:w-auto min-h-[44px]"
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
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {!email.is_read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                        )}
                        <Link href={`/emails/${email.id}`} className="font-semibold hover:underline truncate text-sm md:text-base">
                          {email.subject}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Direction/Type Badge */}
                        <Badge className={getStatusColor(email.status, email.direction || undefined)}>
                          <span className="flex items-center gap-1 text-xs">
                            {getStatusIcon(email.status, email.direction || undefined)}
                            <span className="hidden sm:inline">{getStatusLabel(email.status, email.direction || undefined)}</span>
                          </span>
                        </Badge>
                        {/* Status Badge (only for outbound emails) */}
                        {email.direction === 'outbound' && (
                          <Badge className={getStatusOnlyColor(email.status)}>
                            <span className="flex items-center gap-1 text-xs">
                              {getStatusIcon(email.status)}
                              <span className="hidden sm:inline">{email.status}</span>
                            </span>
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground mb-2">
                      {email.direction === 'inbound' ? (
                        <>
                          <span className="font-medium">From:</span> <span className="truncate block sm:inline">{email.from_email}</span>
                          {email.from_name && <span className="hidden sm:inline"> ({email.from_name})</span>}
                        </>
                      ) : (
                        <>
                          <span className="font-medium">To:</span> <span className="truncate block sm:inline">{email.to_email}</span>
                          {email.to_name && <span className="hidden sm:inline"> ({email.to_name})</span>}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 sm:space-y-0">
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        <span>Created: {format(new Date(email.created_at), 'MMM d, yyyy')}</span>
                        {email.sent_at && (
                          <span>• Sent: {format(new Date(email.sent_at), 'MMM d, yyyy')}</span>
                        )}
                        {email.scheduled_at && (
                          <span className="hidden md:inline">• Scheduled: {format(new Date(email.scheduled_at), 'MMM d, yyyy')}</span>
                        )}
                        {email.deleted_at && (
                          <span className="hidden md:inline">• Deleted: {format(new Date(email.deleted_at), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                    </div>
                    {email.error_message && (
                      <div className="mt-2 text-xs md:text-sm text-red-600">
                        Error: {email.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                    {folderFilter !== 'trash' && (
                      <>
                        {(email.status === 'sent' || email.direction === 'inbound') && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/emails/${email.id}/reply`)}
                              title="Reply"
                              className="min-h-[44px] min-w-[44px] md:h-8 md:w-8 p-0"
                            >
                              <Reply className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/emails/${email.id}/forward`)}
                              title="Forward"
                              className="min-h-[44px] min-w-[44px] md:h-8 md:w-8 p-0"
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
                          className="min-h-[44px] min-w-[44px] md:h-8 md:w-8 p-0"
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
                      <Button variant="ghost" size="sm" title="View" className="min-h-[44px] min-w-[44px] md:h-8 md:w-8 p-0">
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
                          className="min-h-[44px] min-w-[44px] md:h-8 md:w-8 p-0"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePermanentlyDelete(email.id)}
                          title="Permanently delete"
                          className="min-h-[44px] min-w-[44px] md:h-8 md:w-8 p-0"
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
                        className="min-h-[44px] min-w-[44px] md:h-8 md:w-8 p-0"
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





























