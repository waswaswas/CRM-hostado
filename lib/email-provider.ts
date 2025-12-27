import nodemailer from 'nodemailer'

interface EmailConfig {
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

let transporter: nodemailer.Transporter | null = null

function getEmailConfig(): EmailConfig | null {
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

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) {
    return transporter
  }

  const config = getEmailConfig()
  if (!config) {
    return null
  }

  // Configure transporter with proper SSL/TLS settings
  const transporterConfig: any = {
    host: config.host,
    port: config.port,
    secure: config.secure, // true for port 465 (SSL/TLS), false for port 587 (STARTTLS)
    auth: {
      user: config.auth.user,
      pass: config.auth.password, // nodemailer uses 'pass' not 'password'
    },
    // Additional TLS options for better compatibility
    tls: {
      rejectUnauthorized: false, // Accept self-signed certificates if needed
    },
  }

  // For port 587, require TLS
  if (config.port === 587) {
    transporterConfig.requireTLS = true
  }

  try {
    transporter = nodemailer.createTransport(transporterConfig)
    return transporter
  } catch (error) {
    console.error('Failed to create transporter:', error)
    return null
  }
}

export async function sendEmail(options: SendEmailOptions): Promise<{
  success: boolean
  messageId?: string
  error?: string
  response?: any
}> {
  const transporter = getTransporter()
  if (!transporter) {
    return {
      success: false,
      error: 'Email provider is not configured. Please set SMTP environment variables.',
    }
  }

  const config = getEmailConfig()
  if (!config) {
    return {
      success: false,
      error: 'Email configuration is missing.',
    }
  }

  try {
    // Verify connection before sending
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

    // Add attachments if provided
    if (options.attachments && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments.map((att) => {
        // If path is a Buffer, use content property instead
        if (Buffer.isBuffer(att.path)) {
          return {
            filename: att.filename,
            content: att.path,
            contentType: att.contentType,
          }
        }
        return {
          filename: att.filename,
          path: att.path,
          contentType: att.contentType,
        }
      })
    }

    const info = await transporter.sendMail(mailOptions)

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    }
  } catch (error) {
    console.error('Error sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
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











