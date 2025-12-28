'use server'

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email-provider'
import { createInteraction } from './interactions'

export type EmailStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'bounced'

export type EmailFolder = 'inbox' | 'sent' | 'draft' | 'trash'
export type EmailDirection = 'inbound' | 'outbound'

export interface Email {
  id: string
  created_at: string
  updated_at: string
  owner_id: string
  client_id: string
  subject: string
  body_html: string
  body_text: string | null
  from_email: string
  from_name: string
  to_email: string
  to_name: string | null
  cc_emails: string[] | null
  bcc_emails: string[] | null
  status: EmailStatus
  scheduled_at: string | null
  sent_at: string | null
  provider_message_id: string | null
  provider_response: any
  signature_id: string | null
  template_id: string | null
  metadata: any
  error_message: string | null
  retry_count: number
  direction: EmailDirection | null
  folder: EmailFolder
  is_read: boolean
  is_deleted: boolean
  deleted_at: string | null
  in_reply_to: string | null
  forwarded_from: string | null
}

export interface CreateEmailInput {
  client_id: string
  subject: string
  body_html: string
  body_text?: string
  to_email: string
  to_name?: string
  cc_emails?: string[]
  bcc_emails?: string[]
  signature_id?: string | null
  template_id?: string | null
  scheduled_at?: string | null
  direction?: EmailDirection
  folder?: EmailFolder
}

export interface CreateInboundEmailInput {
  client_id?: string
  from_email: string
  from_name: string
  subject: string
  body_html: string
  body_text?: string
  to_email?: string
  to_name?: string
  cc_emails?: string[]
  received_at?: string
}

export async function createEmail(input: CreateEmailInput): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get default signature if signature_id is not provided
  let signatureId = input.signature_id
  if (!signatureId) {
    const { data: defaultSignature } = await supabase
      .from('email_signatures')
      .select('id')
      .eq('owner_id', user.id)
      .eq('is_default', true)
      .single()

    if (defaultSignature) {
      signatureId = defaultSignature.id
    }
  }

  // Get signature HTML if exists (only add if not already in body_html)
  let bodyHtml = input.body_html
  if (signatureId) {
    const { data: signature } = await supabase
      .from('email_signatures')
      .select('html_content')
      .eq('id', signatureId)
      .single()

    if (signature && signature.html_content) {
      // Only add signature if it's not already in the body_html
      if (!bodyHtml.includes(signature.html_content)) {
        // Add single <br> to separate body from signature (not double to avoid extra spacing)
        bodyHtml = `${bodyHtml}<br>${signature.html_content}`
      }
    }
  }

  // Get from email/name from environment or user
  const fromEmail = process.env.SMTP_FROM_EMAIL || user.email || ''
  const fromName = process.env.SMTP_FROM_NAME || 'Pre-Sales CRM'

  const status: EmailStatus = input.scheduled_at ? 'scheduled' : 'draft'
  const folder: EmailFolder = input.folder || (status === 'draft' ? 'draft' : 'sent')
  const direction: EmailDirection = input.direction || 'outbound'

  const { data, error } = await supabase
    .from('emails')
    .insert({
      owner_id: user.id,
      client_id: input.client_id,
      subject: input.subject,
      body_html: bodyHtml,
      body_text: input.body_text,
      from_email: fromEmail,
      from_name: fromName,
      to_email: input.to_email,
      to_name: input.to_name,
      cc_emails: input.cc_emails || [],
      bcc_emails: input.bcc_emails || [],
      status,
      scheduled_at: input.scheduled_at || null,
      signature_id: signatureId,
      template_id: input.template_id || null,
      folder,
      direction,
      is_read: false,
      is_deleted: false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create email: ${error.message}`)
  }

  return data as Email
}

export async function createInboundEmail(input: CreateInboundEmailInput): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get to_email from environment if not provided
  const toEmail = input.to_email || process.env.SMTP_FROM_EMAIL || user.email || ''
  const toName = input.to_name || process.env.SMTP_FROM_NAME || 'Pre-Sales CRM'

  // FIRST: Check if this email already exists (prevent duplicates and client recreation)
  const receivedAt = input.received_at ? new Date(input.received_at).toISOString() : new Date().toISOString()
  
  // Check for existing email by from_email and subject (wider time window - 24 hours)
  const { data: existingEmail } = await supabase
    .from('emails')
    .select('id, client_id, from_email, sent_at')
    .eq('owner_id', user.id)
    .eq('from_email', input.from_email)
    .eq('subject', input.subject)
    .eq('direction', 'inbound')
    .gte('sent_at', new Date(new Date(receivedAt).getTime() - 24 * 60 * 60 * 1000).toISOString()) // Within 24 hours
    .lte('sent_at', new Date(new Date(receivedAt).getTime() + 24 * 60 * 60 * 1000).toISOString())
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Also check if ANY email exists from this sender with this subject (no time limit, but verify date is close)
  if (!existingEmail) {
    const { data: emailBySenderAndSubject } = await supabase
      .from('emails')
      .select('id, client_id, from_email, sent_at')
      .eq('owner_id', user.id)
      .eq('from_email', input.from_email)
      .eq('subject', input.subject)
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    // Only consider it a duplicate if the sent_at date is very close (within 1 day)
    if (emailBySenderAndSubject) {
      const existingDate = new Date(emailBySenderAndSubject.sent_at)
      const currentDate = new Date(receivedAt)
      const timeDiff = Math.abs(currentDate.getTime() - existingDate.getTime())
      const oneDay = 24 * 60 * 60 * 1000
      
      if (timeDiff < oneDay) {
        // Email exists, skip processing
        console.log(`[Email] Email already processed, skipping: ${input.subject} from ${input.from_email} (existing email ID: ${emailBySenderAndSubject.id})`)
        throw new Error('This email has already been processed')
      }
    }
  } else {
    // Email exists within 24 hours, skip processing
    console.log(`[Email] Email already processed, skipping: ${input.subject} from ${input.from_email} (existing email ID: ${existingEmail.id})`)
    throw new Error('This email has already been processed')
  }

  // SECOND: Before checking for clients, check if we have ANY emails from this sender
  // If we do, and the client was deleted, don't recreate it
  if (!input.client_id && input.from_email) {
    const { data: anyEmailsFromSender } = await supabase
      .from('emails')
      .select('id, from_email, sent_at')
      .eq('owner_id', user.id)
      .eq('from_email', input.from_email)
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // If we have emails from this sender, check if a client with this email exists
    // If no client exists but emails do, it means the client was deleted
    // In that case, don't recreate the client
    if (anyEmailsFromSender) {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_id', user.id)
        .eq('email', input.from_email)
        .single()

      if (!existingClient) {
        // We have emails from this sender but no client exists
        // This means the client was deleted - don't recreate it
        console.log(`[Email] Found emails from ${input.from_email} but client was deleted. Skipping to prevent recreation.`)
        throw new Error('Cannot process email: associated client was deleted. Please restore the client or process manually.')
      }
    }
  }

  // Try to find client by email if client_id not provided
  let clientId = input.client_id
  if (!clientId && input.from_email) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', input.from_email)
      .eq('owner_id', user.id)
      .single()

    if (client) {
      clientId = client.id
    } else {
      // Create a new client if not found (only if no emails exist from this sender)
      const { createClientRecord } = await import('./clients')
      const newClient = await createClientRecord({
        name: input.from_name || input.from_email.split('@')[0],
        email: input.from_email,
        client_type: 'presales',
      })
      clientId = newClient.id
    }
  }

  if (!clientId) {
    throw new Error('Client ID is required or could not be determined from email')
  }

  const { data, error } = await supabase
    .from('emails')
    .insert({
      owner_id: user.id,
      client_id: clientId,
      subject: input.subject,
      body_html: input.body_html,
      body_text: input.body_text || input.body_html.replace(/<[^>]*>/g, ''),
      from_email: input.from_email,
      from_name: input.from_name,
      to_email: toEmail,
      to_name: toName,
      cc_emails: input.cc_emails || [],
      bcc_emails: [],
      status: 'sent',
      sent_at: receivedAt,
      folder: 'inbox',
      direction: 'inbound',
      is_read: false,
      is_deleted: false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create inbound email: ${error.message}`)
  }

  // Create interaction
  try {
    await createInteraction({
      client_id: clientId,
      type: 'email',
      direction: 'inbound',
      date: receivedAt,
      subject: input.subject,
      notes: input.body_text || input.body_html,
      email_id: data.id,
    })
  } catch (interactionError) {
    console.error('Failed to create interaction:', interactionError)
  }

  return data as Email
}

export async function sendEmailNow(emailId: string): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get email
  const { data: email, error: fetchError } = await supabase
    .from('emails')
    .select('*')
    .eq('id', emailId)
    .eq('owner_id', user.id)
    .single()

  if (fetchError || !email) {
    throw new Error('Email not found')
  }

  if (email.status === 'sent') {
    throw new Error('Email already sent')
  }

  // Update status to sending
  await supabase
    .from('emails')
    .update({ status: 'sending' })
    .eq('id', emailId)

  // Get attachments
  const { getEmailAttachments } = await import('./email-attachments')
  const attachments = await getEmailAttachments(emailId).catch(() => [])

  // Download attachments and prepare for email
  const emailAttachments = []
  for (const attachment of attachments) {
    try {
      const { data, error } = await supabase.storage
        .from('email-attachments')
        .download(attachment.file_path)

      if (error || !data) {
        console.error(`Failed to download attachment ${attachment.file_name}:`, error)
        continue
      }

      // Convert blob to buffer
      const arrayBuffer = await data.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      emailAttachments.push({
        filename: attachment.file_name,
        path: buffer,
        contentType: attachment.mime_type,
      })
    } catch (error) {
      console.error(`Error processing attachment ${attachment.file_name}:`, error)
    }
  }

  // Send email
  const result = await sendEmail({
    to: email.to_email,
    toName: email.to_name || undefined,
    subject: email.subject,
    html: email.body_html,
    text: email.body_text || undefined,
    cc: email.cc_emails || undefined,
    bcc: email.bcc_emails || undefined,
    attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
  })

  if (result.success) {
    // Update email status
    const { data: updatedEmail, error: updateError } = await supabase
      .from('emails')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: result.messageId,
        provider_response: result.response,
        error_message: null,
        folder: 'sent',
      })
      .eq('id', emailId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update email: ${updateError.message}`)
    }

    // Create interaction
    try {
      await createInteraction({
        client_id: email.client_id,
        type: 'email',
        direction: 'outbound',
        date: new Date().toISOString(),
        subject: email.subject,
        notes: email.body_text || email.body_html,
        email_id: emailId,
      })
    } catch (error) {
      console.error('Failed to create interaction:', error)
    }

    return updatedEmail as Email
  } else {
    // Update email status to failed
    const { data: updatedEmail, error: updateError } = await supabase
      .from('emails')
      .update({
        status: 'failed',
        error_message: result.error,
        retry_count: (email.retry_count || 0) + 1,
      })
      .eq('id', emailId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update email: ${updateError.message}`)
    }

    throw new Error(result.error || 'Failed to send email')
  }
}

export async function scheduleEmail(emailId: string, scheduledAt: string): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('emails')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt,
    })
    .eq('id', emailId)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to schedule email: ${error.message}`)
  }

  return data as Email
}

export async function updateEmail(emailId: string, updates: Partial<CreateEmailInput>): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // If signature is updated, append it to body_html
  let bodyHtml = updates.body_html
  if (bodyHtml && (updates.signature_id !== undefined)) {
    const signatureId = updates.signature_id
    if (signatureId) {
      const { data: signature } = await supabase
        .from('email_signatures')
        .select('html_content')
        .eq('id', signatureId)
        .single()

      if (signature) {
        bodyHtml = `${bodyHtml}<br><br>${signature.html_content}`
      }
    }
  }

  const updateData: any = { ...updates }
  if (bodyHtml) {
    updateData.body_html = bodyHtml
  }

  const { data, error } = await supabase
    .from('emails')
    .update(updateData)
    .eq('id', emailId)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update email: ${error.message}`)
  }

  return data as Email
}

export async function deleteEmail(emailId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Move to trash instead of permanent delete
  const { error } = await supabase
    .from('emails')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      folder: 'trash',
    })
    .eq('id', emailId)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(`Failed to delete email: ${error.message}`)
  }
}

export async function permanentlyDeleteEmail(emailId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    .from('emails')
    .delete()
    .eq('id', emailId)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(`Failed to permanently delete email: ${error.message}`)
  }
}

export async function restoreEmail(emailId: string): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get the email to determine original folder
  const { data: email } = await supabase
    .from('emails')
    .select('*')
    .eq('id', emailId)
    .eq('owner_id', user.id)
    .single()

  if (!email) {
    throw new Error('Email not found')
  }

  // Restore to original folder (inbox for inbound, sent for outbound)
  const restoredFolder = email.direction === 'inbound' ? 'inbox' : 'sent'

  const { data, error } = await supabase
    .from('emails')
    .update({
      is_deleted: false,
      deleted_at: null,
      folder: restoredFolder,
    })
    .eq('id', emailId)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to restore email: ${error.message}`)
  }

  return data as Email
}

export async function markEmailAsRead(emailId: string, isRead: boolean = true): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('emails')
    .update({ is_read: isRead })
    .eq('id', emailId)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update email read status: ${error.message}`)
  }

  return data as Email
}

export async function replyToEmail(
  originalEmailId: string,
  replyData: {
    subject: string
    body_html: string
    body_text?: string
    to_email: string
    to_name?: string
    cc_emails?: string[]
    bcc_emails?: string[]
    signature_id?: string | null
  }
): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get original email
  const { data: originalEmail } = await supabase
    .from('emails')
    .select('*')
    .eq('id', originalEmailId)
    .eq('owner_id', user.id)
    .single()

  if (!originalEmail) {
    throw new Error('Original email not found')
  }

  // Create reply email
  const reply = await createEmail({
    client_id: originalEmail.client_id,
    subject: replyData.subject,
    body_html: replyData.body_html,
    body_text: replyData.body_text,
    to_email: replyData.to_email,
    to_name: replyData.to_name,
    cc_emails: replyData.cc_emails,
    bcc_emails: replyData.bcc_emails,
    signature_id: replyData.signature_id,
  })

  // Link reply to original
  await supabase
    .from('emails')
    .update({ in_reply_to: originalEmailId, folder: 'sent', direction: 'outbound' })
    .eq('id', reply.id)

  // Mark original as read
  await markEmailAsRead(originalEmailId, true)

  return reply
}

export async function forwardEmail(
  originalEmailId: string,
  forwardData: {
    to_email: string
    to_name?: string
    subject: string
    body_html: string
    body_text?: string
    cc_emails?: string[]
    bcc_emails?: string[]
    signature_id?: string | null
  }
): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get original email
  const { data: originalEmail } = await supabase
    .from('emails')
    .select('*')
    .eq('id', originalEmailId)
    .eq('owner_id', user.id)
    .single()

  if (!originalEmail) {
    throw new Error('Original email not found')
  }

  // Create forwarded email
  const forwarded = await createEmail({
    client_id: originalEmail.client_id,
    subject: forwardData.subject,
    body_html: forwardData.body_html,
    body_text: forwardData.body_text,
    to_email: forwardData.to_email,
    to_name: forwardData.to_name,
    cc_emails: forwardData.cc_emails,
    bcc_emails: forwardData.bcc_emails,
    signature_id: forwardData.signature_id,
  })

  // Link forward to original
  await supabase
    .from('emails')
    .update({ forwarded_from: originalEmailId, folder: 'sent', direction: 'outbound' })
    .eq('id', forwarded.id)

  return forwarded
}

export async function checkForNewEmails(): Promise<{
  success: boolean
  processed: number
  errors: string[]
}> {
  // Import dynamically to avoid loading IMAP in environments where it's not needed
  try {
    const { checkForNewEmails: checkEmails } = await import('@/lib/email-receiver')
    return await checkEmails()
  } catch (error) {
    console.error('Failed to check for new emails:', error)
    return {
      success: false,
      processed: 0,
      errors: [
        error instanceof Error
          ? error.message
          : 'Failed to check for new emails. Make sure IMAP packages are installed and configured.',
      ],
    }
  }
}

export async function cleanupOldTrashEmails(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Delete emails in trash older than 150 days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 150)

  const { data, error } = await supabase
    .from('emails')
    .delete()
    .eq('owner_id', user.id)
    .eq('is_deleted', true)
    .lt('deleted_at', cutoffDate.toISOString())
    .select('id')

  if (error) {
    throw new Error(`Failed to cleanup trash emails: ${error.message}`)
  }

  return data?.length || 0
}

export async function getEmails(filters?: {
  client_id?: string
  status?: EmailStatus
  folder?: EmailFolder
  limit?: number
}): Promise<Email[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  let query = supabase
    .from('emails')
    .select('*')
    .eq('owner_id', user.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (filters?.client_id) {
    query = query.eq('client_id', filters.client_id)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.folder) {
    query = query.eq('folder', filters.folder)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch emails: ${error.message}`)
  }

  return (data || []) as Email[]
}

export async function getTrashEmails(): Promise<Email[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('owner_id', user.id)
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch trash emails: ${error.message}`)
  }

  return (data || []) as Email[]
}

export async function getEmail(emailId: string): Promise<Email> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('id', emailId)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch email: ${error.message}`)
  }

  return data as Email
}














