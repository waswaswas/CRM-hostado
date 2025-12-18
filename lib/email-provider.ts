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

interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
  cc?: string[]
  bcc?: string[]
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
    return null
  }

  return {
    host,
    port: parseInt(port, 10),
    secure: port === '465' || port === '587', // true for 465, false for other ports
    auth: {
      user,
      password,
    },
    from: {
      email: fromEmail,
      name: fromName,
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

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })

  return transporter
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
    const mailOptions = {
      from: `"${config.from.name}" <${config.from.email}>`,
      to: options.toName ? `"${options.toName}" <${options.to}>` : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      cc: options.cc,
      bcc: options.bcc,
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
