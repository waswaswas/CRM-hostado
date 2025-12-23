import * as Imap from 'imap'
import { simpleParser, ParsedMail } from 'mailparser'
import { createInboundEmail } from '@/app/actions/emails'

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
  let processedCount = 0

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
          resolve({ success: false, processed: processedCount, errors })
          return
        }

        // Search for unread emails
        imap.search(['UNSEEN'], async (err, results) => {
          if (err) {
            errors.push(`Failed to search emails: ${err.message}`)
            imap.end()
            resolve({ success: false, processed: processedCount, errors })
            return
          }

          if (!results || results.length === 0) {
            imap.end()
            resolve({ success: true, processed: 0, errors: [] })
            return
          }

          // Fetch emails
          const fetch = imap.fetch(results, { bodies: '' })

          const emailPromises: Promise<void>[] = []

          fetch.on('message', (msg, seqno) => {
            const emailPromise = new Promise<void>((resolve) => {
              msg.on('body', async (stream: NodeJS.ReadableStream, info) => {
                try {
                  const parsed = await simpleParser(stream as any)
                  const processedEmail: ProcessedEmail = {
                    uid: results[seqno - 1],
                    subject: parsed.subject || '(No Subject)',
                    from: {
                      name: parsed.from?.text || parsed.from?.value?.[0]?.name || '',
                      address: parsed.from?.value?.[0]?.address || parsed.from?.text || '',
                    },
                    to: (parsed.to?.value || []).map((addr: any) => ({
                      name: addr.name || '',
                      address: addr.address || '',
                    })),
                    cc: parsed.cc?.value
                      ? (parsed.cc.value as any[]).map((addr: any) => ({
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
                    await processEmail(processedEmail)
                    processedCount++

                    // Mark as read (SEEN)
                    imap.addFlags(results[seqno - 1], '\\Seen', (flagErr) => {
                      if (flagErr) {
                        console.error(`Failed to mark email ${results[seqno - 1]} as read:`, flagErr)
                      }
                    })
                  } catch (processErr) {
                    const errorMsg = `Failed to process email ${processedEmail.uid}: ${
                      processErr instanceof Error ? processErr.message : 'Unknown error'
                    }`
                    errors.push(errorMsg)
                    console.error(errorMsg, processErr)
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
            resolve({ success: true, processed: processedCount, errors })
          })

          fetch.once('error', (fetchErr) => {
            errors.push(`Fetch error: ${fetchErr.message}`)
            imap.end()
            resolve({ success: false, processed: processedCount, errors })
          })
        })
      })
    })

    imap.once('error', (err) => {
      errors.push(`IMAP connection error: ${err.message}`)
      resolve({ success: false, processed: processedCount, errors })
    })

    imap.connect()
  })
}

async function processEmail(email: ProcessedEmail): Promise<void> {
  // Get the "to" email address (should be the CRM email)
  const toEmail = email.to[0]?.address || process.env.SMTP_FROM_EMAIL || ''
  const toName = email.to[0]?.name || process.env.SMTP_FROM_NAME || 'Pre-Sales CRM'

  // Create inbound email record
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
}

export function isImapConfigured(): boolean {
  return getImapConfig() !== null
}
