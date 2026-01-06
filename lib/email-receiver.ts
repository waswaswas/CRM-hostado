import Imap from 'imap'
import { simpleParser, ParsedMail } from 'mailparser'
import { createInboundEmail } from '@/app/actions/emails'
import { parseContactFormEmail } from './contact-form-parser'

interface ImapConfig {
  host: string
  port: number
  user: string
  password: string
  tls: boolean
  tlsOptions?: {
    rejectUnauthorized: boolean
  }
}

interface ProcessedEmail {
  uid: number
  subject: string
  from: {
    name: string
    address: string
  }
  to: {
    name: string
    address: string
  }[]
  cc?: {
    name: string
    address: string
  }[]
  html: string
  text: string
  date: Date
  messageId?: string
}

function getImapConfig(): ImapConfig | null {
  const host = process.env.IMAP_HOST
  const port = process.env.IMAP_PORT
  const user = process.env.IMAP_USER
  const password = process.env.IMAP_PASSWORD
  const tls = process.env.IMAP_TLS !== 'false' // Default to true

  if (!host || !port || !user || !password) {
    console.error('IMAP configuration missing:', {
      hasHost: !!host,
      hasPort: !!port,
      hasUser: !!user,
      hasPassword: !!password,
    })
    return null
  }

  return {
    host: host.trim(),
    port: parseInt(port, 10),
    user: user.trim(),
    password: password.trim(),
    tls: tls,
    tlsOptions: {
      rejectUnauthorized: process.env.IMAP_REJECT_UNAUTHORIZED === 'false' ? false : true,
    },
  }
}

export async function checkForNewEmails(): Promise<{
  success: boolean
  processed: number
  errors: string[]
}> {
  const config = getImapConfig()
  if (!config) {
    return {
      success: false,
      processed: 0,
      errors: ['IMAP configuration is missing. Please set IMAP environment variables.'],
    }
  }

  const errors: string[] = []
  const processedCount = { value: 0 }

  return new Promise((resolve) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: config.tlsOptions,
    })

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          errors.push(`Failed to open INBOX: ${err.message}`)
          imap.end()
          resolve({ success: false, processed: processedCount.value, errors })
          return
        }

        // Search for UNSEEN emails first (most efficient)
        // If that doesn't work, we'll also check recent emails
        console.log(`[IMAP] Searching for UNSEEN emails`)
        
        // First try UNSEEN emails (most common case and fastest)
        const searchCriteria: any[] = ['UNSEEN']

        imap.search(searchCriteria, async (err, results) => {
          if (err) {
            const errorMsg = `Failed to search emails: ${err.message}`
            console.error(`[IMAP] ${errorMsg}`)
            errors.push(errorMsg)
            imap.end()
            resolve({ success: false, processed: processedCount.value, errors })
            return
          }

          if (!results || results.length === 0) {
            console.log('[IMAP] No UNSEEN emails found, checking recent emails (last 10 minutes)')
            
            // If no UNSEEN emails, check for recent emails (last 10 minutes)
            // This catches emails that were already read in cPanel
            const tenMinutesAgo = new Date()
            tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10)
            
            // Format date for IMAP: 'DD-MMM-YYYY' (e.g., '24-Dec-2025')
            const sinceDate = tenMinutesAgo.toLocaleDateString('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })
            
            console.log(`[IMAP] Searching for emails since ${sinceDate} (last 10 minutes)`)
            
            // Search for recent emails
            imap.search(['SINCE', sinceDate], async (err2, results2) => {
              if (err2) {
                console.error(`[IMAP] Failed to search recent emails: ${err2.message}`)
                imap.end()
                resolve({ success: true, processed: 0, errors: [] }) // Don't fail, just return empty
                return
              }
              
              if (!results2 || results2.length === 0) {
                console.log('[IMAP] No recent emails found')
                imap.end()
                resolve({ success: true, processed: 0, errors: [] })
                return
              }
              
              console.log(`[IMAP] Found ${results2.length} recent email(s) to process`)
              // Process these emails (will be filtered by duplicate detection)
              await processEmailBatch(imap, results2, errors, processedCount, resolve)
            })
            return
          }

          console.log(`[IMAP] Found ${results.length} UNSEEN email(s) to process`)
          await processEmailBatch(imap, results, errors, processedCount, resolve)
        })
      })
    })

    imap.once('error', (err: any) => {
      errors.push(`IMAP connection error: ${err.message}`)
      console.error(`[IMAP] Connection error:`, err)
      resolve({ success: false, processed: processedCount.value, errors })
    })

    imap.connect()
  })
}

async function processEmailBatch(
  imap: any,
  results: number[],
  errors: string[],
  processedCount: { value: number },
  resolve: (value: { success: boolean; processed: number; errors: string[] }) => void
) {
  // Fetch emails
  const fetch = imap.fetch(results, { bodies: '' })

  const emailPromises: Promise<void>[] = []

  fetch.on('message', (msg: any, seqno: number) => {
    const emailPromise = new Promise<void>((resolve) => {
      msg.on('body', async (stream: NodeJS.ReadableStream, info: any) => {
        try {
          const parsed = await simpleParser(stream as any)
          const processedEmail: ProcessedEmail = {
            uid: results[seqno - 1],
            subject: parsed.subject || '(No Subject)',
            from: {
              name: parsed.from?.text || parsed.from?.value?.[0]?.name || '',
              address: parsed.from?.value?.[0]?.address || parsed.from?.text || '',
            },
            to: (Array.isArray(parsed.to) ? parsed.to : (parsed.to as any)?.value || []).map((addr: any) => ({
              name: addr.name || '',
              address: addr.address || '',
            })),
            cc: parsed.cc
              ? (Array.isArray(parsed.cc) ? parsed.cc : (parsed.cc as any)?.value || []).map((addr: any) => ({
                  name: addr.name || '',
                  address: addr.address || '',
                }))
              : undefined,
            html: parsed.html || parsed.textAsHtml || '',
            text: parsed.text || '',
            date: parsed.date || new Date(),
            messageId: parsed.messageId,
          }

          // Process the email
          try {
            console.log(`[IMAP] Processing email: ${processedEmail.subject} from ${processedEmail.from.address}`)
            const wasProcessed = await processEmail(processedEmail)
            
            // Only mark as read if email was successfully processed
            // This prevents marking emails as read if they failed to process
                    if (wasProcessed) {
                      processedCount.value++
                      console.log(`[IMAP] Successfully processed email: ${processedEmail.subject}`)

              // Mark as read (SEEN) after successful processing
              // This prevents the email from being processed again
              imap.addFlags(results[seqno - 1], '\\Seen', (flagErr: any) => {
                if (flagErr) {
                  console.error(`[IMAP] Failed to mark email ${results[seqno - 1]} as read:`, flagErr)
                }
              })
            } else {
              // Email was a duplicate or already processed
              console.log(`[IMAP] Email was duplicate or already processed: ${processedEmail.subject}`)
              // Mark as read anyway to avoid checking it repeatedly
              imap.addFlags(results[seqno - 1], '\\Seen', (flagErr: any) => {
                if (flagErr) {
                  console.error(`[IMAP] Failed to mark email ${results[seqno - 1]} as read:`, flagErr)
                }
              })
            }
          } catch (processErr) {
            const errorMsg = `Failed to process email ${processedEmail.uid}: ${
              processErr instanceof Error ? processErr.message : 'Unknown error'
            }`
            errors.push(errorMsg)
            console.error(`[IMAP] ${errorMsg}`, processErr)
            // Don't mark as read if processing failed - we'll try again next time
          }
          resolve()
        } catch (parseErr) {
          const errorMsg = `Failed to parse email ${seqno}: ${
            parseErr instanceof Error ? parseErr.message : 'Unknown error'
          }`
          errors.push(errorMsg)
          console.error(errorMsg, parseErr)
          resolve()
        }
      })

      msg.once('end', () => {
        resolve()
      })
    })

    emailPromises.push(emailPromise)
  })

  fetch.once('end', async () => {
    // Wait for all email processing to complete
    await Promise.all(emailPromises)
    imap.end()
    resolve({ success: true, processed: processedCount.value, errors })
  })

  fetch.once('error', (fetchErr: any) => {
    errors.push(`Fetch error: ${fetchErr.message}`)
    console.error(`[IMAP] Fetch error:`, fetchErr)
    imap.end()
    resolve({ success: false, processed: processedCount.value, errors })
  })
}

async function processEmail(email: ProcessedEmail): Promise<boolean> {
  // Returns true if email was processed, false if it was a duplicate
  
  try {
    // Get the "to" email address (should be the CRM email)
    const toEmail = email.to[0]?.address || process.env.SMTP_FROM_EMAIL || ''
    const toName = email.to[0]?.name || process.env.SMTP_FROM_NAME || 'Pre-Sales CRM'

    // Check if this is a contact form inquiry
    const isContactForm = email.subject.includes('Ново запитване от контактната форма')

    if (isContactForm) {
      console.log(`[Email Processing] Contact form inquiry detected: ${email.subject}`)
      // Parse contact form data
      const formData = parseContactFormEmail(email.html || email.text)
      
      if (formData) {
        console.log(`[Email Processing] Parsed contact form data for: ${formData.name} (${formData.email})`)
        // Process contact form inquiry
        const result = await processContactFormInquiry(formData, email)
        console.log(`[Email Processing] Contact form processing result: ${result ? 'success' : 'duplicate'}`)
        return result
      } else {
        console.warn(`[Email Processing] Failed to parse contact form data for: ${email.subject}`)
        // Fall through to regular email processing
      }
    }

    // Check for duplicate email before processing
    const { createClient: createSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = await createSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Check if email already exists by messageId (most reliable)
    if (email.messageId) {
      const { data: existingEmail } = await supabase
        .from('emails')
        .select('id')
        .eq('owner_id', user.id)
        .eq('provider_message_id', email.messageId)
        .maybeSingle()

      if (existingEmail) {
        console.log(`[Email Processing] Duplicate detected by messageId: ${email.messageId}`)
        return false // Duplicate, already processed
      }
    }

    // Check for duplicate by from_email, subject, and sent_at (within 10 minutes for better catch)
    const emailDate = new Date(email.date)
    const { data: duplicateEmail } = await supabase
      .from('emails')
      .select('id')
      .eq('owner_id', user.id)
      .eq('from_email', email.from.address)
      .eq('subject', email.subject)
      .eq('direction', 'inbound')
      .gte('sent_at', new Date(emailDate.getTime() - 600000).toISOString()) // Within 10 minutes
      .lte('sent_at', new Date(emailDate.getTime() + 600000).toISOString())
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (duplicateEmail) {
      console.log(`[Email Processing] Duplicate detected by content: ${email.from.address} - ${email.subject}`)
      return false // Duplicate, already processed
    }

    console.log(`[Email Processing] Processing new email: ${email.subject} from ${email.from.address}`)
    
    // Regular inbound email processing
    await createInboundEmail({
      from_email: email.from.address,
      from_name: email.from.name || email.from.address.split('@')[0],
      subject: email.subject,
      body_html: email.html || email.text,
      body_text: email.text,
      to_email: toEmail,
      to_name: toName,
      cc_emails: email.cc?.map((c) => c.address),
      received_at: email.date.toISOString(),
    })

    console.log(`[Email Processing] Successfully processed email: ${email.subject}`)
    return true // Successfully processed
  } catch (error) {
    console.error(`[Email Processing] Error processing email ${email.subject}:`, error)
    throw error // Re-throw to be caught by caller
  }
}

async function processContactFormInquiry(
  formData: { name: string; firstName: string; secondName?: string; email: string; phone?: string; subject?: string; message: string },
  email: ProcessedEmail
): Promise<boolean> {
  // Returns true if processed, false if duplicate
  const { createClientRecord } = await import('@/app/actions/clients')
  const { createInteraction } = await import('@/app/actions/interactions')
  const { createClient: createSupabaseClient } = await import('@/lib/supabase/server')

  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const receivedAt = email.date.toISOString()

  // FIRST: Check if this email already exists (prevent duplicates)
  // This is the most important check - if email was already processed, skip entirely
  let existingEmail = null
  
  // Method 1: Check by messageId (most reliable - unique per email)
  if (email.messageId) {
    const { data: emailByMessageId } = await supabase
      .from('emails')
      .select('id, client_id, from_email, provider_message_id')
      .eq('owner_id', user.id)
      .eq('provider_message_id', email.messageId)
      .maybeSingle()
    existingEmail = emailByMessageId
  }

  // Method 2: Check by from_email and subject (wider time window - 7 days to catch re-fetched emails)
  if (!existingEmail) {
    const { data: emailByContent } = await supabase
      .from('emails')
      .select('id, client_id, from_email, provider_message_id')
      .eq('owner_id', user.id)
      .eq('from_email', formData.email)
      .eq('subject', email.subject)
      .eq('direction', 'inbound')
      .gte('sent_at', new Date(new Date(receivedAt).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Within 7 days
      .lte('sent_at', new Date(new Date(receivedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    existingEmail = emailByContent
  }

  // Method 3: Check if ANY email exists from this sender with this subject (no time limit)
  // This catches emails that were processed before, even if dates don't match exactly
  if (!existingEmail) {
    const { data: emailBySenderAndSubject } = await supabase
      .from('emails')
      .select('id, client_id, from_email, sent_at, provider_message_id')
      .eq('owner_id', user.id)
      .eq('from_email', formData.email)
      .eq('subject', email.subject)
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    // Only consider it a duplicate if the sent_at date is very close (within 7 days)
    if (emailBySenderAndSubject) {
      const existingDate = new Date(emailBySenderAndSubject.sent_at)
      const currentDate = new Date(receivedAt)
      const timeDiff = Math.abs(currentDate.getTime() - existingDate.getTime())
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      
      if (timeDiff < sevenDays) {
        existingEmail = emailBySenderAndSubject
      }
    }
  }

  // If email already exists, skip processing entirely (don't recreate clients)
  if (existingEmail) {
    console.log(`[Email Receiver] Email already processed, skipping: ${email.subject} from ${formData.email} (existing email ID: ${existingEmail.id}, messageId: ${existingEmail.provider_message_id || 'none'})`)
    return false // Return false to indicate this was a duplicate
  }

  // THIRD: Check if client already exists by email (prevent duplicates)
  // Only create new clients for contact form inquiries
  const isContactFormInquiry = email.subject === 'Ново запитване от контактната форма'
  
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name, email, phone')
    .eq('owner_id', user.id)
    .eq('email', formData.email)

  let clientId: string | null = null

  if (existingClients && existingClients.length > 0) {
    // Client already exists with this email, use the first one
    clientId = existingClients[0].id
    
    // Update the client if name or phone is missing/updated
    const needsUpdate = 
      !existingClients[0].name || 
      existingClients[0].name !== formData.name ||
      (!existingClients[0].phone && formData.phone)
    
    if (needsUpdate) {
      await supabase
        .from('clients')
        .update({ 
          name: formData.name,
          phone: formData.phone || existingClients[0].phone,
        })
        .eq('id', clientId)
    }
  } else if (isContactFormInquiry) {
    // No client with this email exists, create new one
    // Only create for contact form inquiries (not for delivery failures or other system emails)
    // Set status to 'follow_up_required' to remind to contact them
    const newClient = await createClientRecord({
      name: formData.name, // Full name (cleaned, without "Имейл адрес")
      email: formData.email,
      phone: formData.phone,
      client_type: 'presales',
      status: 'follow_up_required', // Set to follow up required for contact form inquiries
      source: 'contact_form',
    })
    clientId = newClient.id
  } else {
    // Not a contact form inquiry - don't create a client
    console.log(`[Email Receiver] Skipping client creation for email with subject: "${email.subject}"`)
    clientId = null
  }

  // Get the "to" email address
  const toEmail = email.to[0]?.address || process.env.SMTP_FROM_EMAIL || ''
  const toName = email.to[0]?.name || process.env.SMTP_FROM_NAME || 'Pre-Sales CRM'

  // Note: existingEmail check was moved above to prevent client recreation
  // At this point, if we reach here, the email doesn't exist yet

  // Create inbound email record (we already checked it doesn't exist above)
  // client_id may be null if this is not a contact form inquiry
  const emailInsertData: any = {
      owner_id: user.id,
      subject: email.subject,
      body_html: email.html || email.text,
      body_text: email.text || (email.html ? email.html.replace(/<[^>]*>/g, '') : ''),
      from_email: formData.email,
      from_name: formData.name,
      to_email: toEmail,
      to_name: toName,
      cc_emails: [],
      bcc_emails: [],
      status: 'sent',
      sent_at: receivedAt,
      folder: 'inbox',
      direction: 'inbound',
      is_read: false,
      is_deleted: false,
      provider_message_id: email.messageId || null, // Store messageId for duplicate detection
      client_id: clientId, // May be null if not a contact form inquiry
  }

  const { data: emailRecord, error: emailError } = await supabase
    .from('emails')
    .insert(emailInsertData)
    .select()
    .single()

  if (emailError) {
    throw new Error(`Failed to create email record: ${emailError.message}`)
  }

  // Create notification for new inbound email
  if (emailRecord && isContactFormInquiry) {
    try {
      const { createNotification } = await import('@/app/actions/notifications')
      await createNotification({
        type: 'email',
        title: 'New contact form inquiry',
        message: `New inquiry from ${formData.name || formData.email}`,
        related_id: emailRecord.id,
        related_type: 'email',
        metadata: {
          from_email: formData.email,
          from_name: formData.name,
        },
      })
    } catch (error) {
      // Don't fail email creation if notification fails
      console.error('Failed to create notification for email:', error)
    }
  }

  // Only create interaction if client_id exists and it doesn't already exist
  let existingInteraction = null
  if (clientId) {
    const { data: interactionData } = await supabase
      .from('interactions')
      .select('id')
      .eq('client_id', clientId)
      .eq('email_id', emailRecord.id)
      .eq('subject', 'Initial request')
      .eq('type', 'email')
      .eq('direction', 'inbound')
      .single()

    existingInteraction = interactionData

    // Only create interaction if it doesn't exist
    if (!existingInteraction) {
      const interactionNotes = formData.message || email.text || (email.html ? email.html.replace(/<[^>]*>/g, '') : '')

      await createInteraction({
        client_id: clientId,
        type: 'email',
        direction: 'inbound',
        date: receivedAt,
        subject: 'Initial request',
        notes: interactionNotes,
        email_id: emailRecord.id,
      })
    }
  } else {
    console.log(`[Email Receiver] Skipping interaction creation for email ${emailRecord.id} - not a contact form inquiry`)
  }

  // Return true if this was a new email/interaction, false if it was a duplicate
  return !existingInteraction
}

export function isImapConfigured(): boolean {
  return getImapConfig() !== null
}





















