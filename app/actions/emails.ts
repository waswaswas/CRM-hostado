'use server'

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email-provider'
import { createInteraction } from './interactions'

export type EmailStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'bounced'

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
        bodyHtml = `${bodyHtml}<br><br>${signature.html_content}`
      }
    }
  }

  // Get from email/name from environment or user
  const fromEmail = process.env.SMTP_FROM_EMAIL || user.email || ''
  const fromName = process.env.SMTP_FROM_NAME || 'Pre-Sales CRM'

  const status: EmailStatus = input.scheduled_at ? 'scheduled' : 'draft'

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
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create email: ${error.message}`)
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

  // Send email
  const result = await sendEmail({
    to: email.to_email,
    toName: email.to_name || undefined,
    subject: email.subject,
    html: email.body_html,
    text: email.body_text || undefined,
    cc: email.cc_emails || undefined,
    bcc: email.bcc_emails || undefined,
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

  const { error } = await supabase
    .from('emails')
    .delete()
    .eq('id', emailId)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(`Failed to delete email: ${error.message}`)
  }
}

export async function getEmails(filters?: {
  client_id?: string
  status?: EmailStatus
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
    .order('created_at', { ascending: false })

  if (filters?.client_id) {
    query = query.eq('client_id', filters.client_id)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
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


