import nodemailer from 'nodemailer'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    password: string
  }
  from: {
    email: string
    name: string
  }
}

interface Attachment {
  filename: string
  path: Buffer | string
  contentType: string
}

interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
  cc?: string[]
  bcc?: string[]
  attachments?: Attachment[]
}

export function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  const fromEmail = process.env.SMTP_FROM_EMAIL
  const fromName = process.env.SMTP_FROM_NAME

  if (!host || !port || !user || !password || !fromEmail || !fromName) {
    console.error('SMTP configuration missing:', {
      hasHost: !!host,
      hasPort: !!port,
      hasUser: !!user,
      hasPassword: !!password,
      hasFromEmail: !!fromEmail,
      hasFromName: !!fromName,
    })
    return null
  }

  const portNum = parseInt(port, 10)
  // Port 465 uses SSL/TLS (secure: true)
  // Port 587 uses STARTTLS (secure: false, requireTLS: true)
  const isSecurePort = portNum === 465

  return {
    host,
    port: portNum,
    secure: isSecurePort,
    auth: {
      user: user.trim(),
      password: password.trim(),
    },
    from: {
      email: fromEmail.trim(),
      name: fromName.trim(),
    },
  }
}

function buildTransporterFromConfig(config: EmailConfig): nodemailer.Transporter {
  const transporterConfig: any = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.password,
    },
    tls: { rejectUnauthorized: false },
  }
  if (config.port === 587) {
    transporterConfig.requireTLS = true
  }
  return nodemailer.createTransport(transporterConfig)
}

async function sendWithConfig(
  options: SendEmailOptions,
  config: EmailConfig
): Promise<{ success: boolean; messageId?: string; error?: string; response?: any }> {
  const transporter = buildTransporterFromConfig(config)
  try {
    await transporter.verify()
    const mailOptions: any = {
      from: `"${config.from.name}" <${config.from.email}>`,
      to: options.toName ? `"${options.toName}" <${options.to}>` : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      cc: options.cc,
      bcc: options.bcc,
    }
    if (options.attachments && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments.map((att) => {
        if (Buffer.isBuffer(att.path)) {
          return { filename: att.filename, content: att.path, contentType: att.contentType }
        }
        return { filename: att.filename, path: att.path, contentType: att.contentType }
      })
    }
    const info = await transporter.sendMail(mailOptions)
    return { success: true, messageId: info.messageId, response: info.response }
  } catch (error) {
    console.error('Error sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/** Send using optional config (e.g. org settings). If config is omitted (undefined), uses env (hostado). If explicitly null, returns error. */
export async function sendEmail(
  options: SendEmailOptions,
  config?: EmailConfig | null
): Promise<{
  success: boolean
  messageId?: string
  error?: string
  response?: any
}> {
  const effectiveConfig = config !== undefined ? config : getEmailConfig()
  if (!effectiveConfig) {
    return {
      success: false,
      error:
        config === undefined
          ? 'Email provider is not configured. Please set SMTP environment variables.'
          : 'Email is not configured for this organization. Add SMTP details in Organization Settings.',
    }
  }
  return sendWithConfig(options, effectiveConfig)
}

export function isEmailConfigured(): boolean {
  return getEmailConfig() !== null
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}





























