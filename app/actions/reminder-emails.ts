'use server'

import { createAdminClient, getAdminConfigError } from '@/lib/supabase/admin'
import { sendEmail, getEmailConfig } from '@/lib/email-provider'
import { getOrganizationEmailConfigForSendingById } from '@/app/actions/organizations'
import {
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notification-preferences'
import { headers } from 'next/headers'

async function getAppBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') || h.get('host')
    const proto = h.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
    if (host) return `${proto}://${host}`
  } catch {
    // ignore
  }
  return process.env.NODE_ENV === 'production' ? 'https://gms.hostado.net' : 'http://localhost:3000'
}

function daysOverdue(dueAt: string, now: Date): number {
  const due = new Date(dueAt).getTime()
  const diffMs = now.getTime() - due
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

function buildReminderEmailHtml(opts: {
  reminderTitle: string
  reminderDescription: string | null
  dueAt: string
  clientName: string
  daysOverdue: number
  clientUrl: string
}): string {
  const dueFormatted = new Date(opts.dueAt).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const desc = opts.reminderDescription
    ? `<p style="color:#64748b;margin:8px 0 16px;">${escapeHtml(opts.reminderDescription)}</p>`
    : ''

  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:12px;padding:28px;border:1px solid #334155;">
    <h1 style="margin:0 0 8px;font-size:20px;color:#f8fafc;">Overdue reminder</h1>
    <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;">
      This reminder is <strong style="color:#fbbf24;">${opts.daysOverdue} day${opts.daysOverdue === 1 ? '' : 's'}</strong> past due.
    </p>
    <h2 style="margin:0 0 4px;font-size:16px;color:#f8fafc;">${escapeHtml(opts.reminderTitle)}</h2>
    ${desc}
    <p style="font-size:14px;color:#94a3b8;margin:0 0 4px;">
      <strong style="color:#cbd5e1;">Client:</strong> ${escapeHtml(opts.clientName)}
    </p>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">
      <strong style="color:#cbd5e1;">Due:</strong> ${dueFormatted}
    </p>
    <a href="${opts.clientUrl}"
       style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">
      Open client
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#64748b;">
      You received this because reminder emails are enabled in your Hostado settings.
    </p>
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function normalizePrefs(row: Record<string, unknown> | null): NotificationPreferences {
  return normalizeNotificationPreferences(row)
}

/**
 * Cron: send reminder emails for users who opted in, at 3 and/or 7 days after due date.
 * Uses service role so it works without a logged-in session.
 */
export async function processReminderEmails(): Promise<{
  processed: number
  sent: number
  skipped: number
  errors: number
}> {
  const adminErr = getAdminConfigError()
  if (adminErr) throw new Error(adminErr)

  const admin = createAdminClient()
  if (!admin) throw new Error('Admin client unavailable')

  const baseUrl = await getAppBaseUrl()
  const now = new Date()

  const { data: prefRows, error: prefErr } = await admin
    .from('notification_preferences')
    .select('*')
    .eq('reminder_emails_enabled', true)

  if (prefErr) throw new Error(prefErr.message)
  if (!prefRows?.length) {
    return { processed: 0, sent: 0, skipped: 0, errors: 0 }
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const prefRow of prefRows) {
    const prefs = normalizePrefs(prefRow as Record<string, unknown>)
    const userId = prefRow.user_id as string
    if (!prefs.reminder_emails_enabled) continue
    if (!prefs.reminder_emails_3_days && !prefs.reminder_emails_7_days) continue

    const { data: clients } = await admin
      .from('clients')
      .select('id, name, company, organization_id')
      .eq('owner_id', userId)
      .eq('is_deleted', false)

    if (!clients?.length) continue

    const clientIds = clients.map((c) => c.id)
    const clientsMap = new Map(clients.map((c) => [c.id, c]))

    const { data: overdueReminders } = await admin
      .from('reminders')
      .select('id, title, description, due_at, client_id, organization_id')
      .in('client_id', clientIds)
      .eq('done', false)
      .lt('due_at', now.toISOString())

    if (!overdueReminders?.length) continue

    let userEmail: string | null = null
    const { data: profile } = await admin
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle()
    userEmail = profile?.email || null
    if (!userEmail) {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(userId)
        userEmail = authUser.user?.email || null
      } catch {
        skipped++
        continue
      }
    }
    if (!userEmail) {
      skipped++
      continue
    }

    for (const reminder of overdueReminders) {
      if (!reminder.client_id) continue
      const overdue = daysOverdue(reminder.due_at, now)
      const milestones: number[] = []
      if (prefs.reminder_emails_3_days && overdue >= 3) milestones.push(3)
      if (prefs.reminder_emails_7_days && overdue >= 7) milestones.push(7)

      for (const milestone of milestones) {
        processed++
        const { data: existing } = await admin
          .from('reminder_email_sends')
          .select('id')
          .eq('reminder_id', reminder.id)
          .eq('user_id', userId)
          .eq('milestone_days', milestone)
          .maybeSingle()

        if (existing) {
          skipped++
          continue
        }

        const client = clientsMap.get(reminder.client_id)
        const clientName = client?.name || client?.company || 'Client'
        const clientUrl = `${baseUrl}/clients/${reminder.client_id}`
        const subject =
          milestone === 7
            ? `Reminder 7 days overdue: ${reminder.title}`
            : `Reminder 3 days overdue: ${reminder.title}`

        const html = buildReminderEmailHtml({
          reminderTitle: reminder.title,
          reminderDescription: reminder.description,
          dueAt: reminder.due_at,
          clientName,
          daysOverdue: overdue,
          clientUrl,
        })

        let orgConfig = null
        if (reminder.organization_id) {
          try {
            orgConfig = await getOrganizationEmailConfigForSendingById(reminder.organization_id)
          } catch {
            orgConfig = null
          }
        }
        const smtpConfig = orgConfig?.config ?? getEmailConfig()

        const result = await sendEmail(
          {
            to: userEmail,
            subject,
            html,
            text: `Overdue reminder: ${reminder.title}\nClient: ${clientName}\nOpen: ${clientUrl}`,
          },
          smtpConfig
        )

        if (!result.success) {
          console.error('Reminder email failed:', result.error)
          errors++
          continue
        }

        await admin.from('reminder_email_sends').insert({
          reminder_id: reminder.id,
          user_id: userId,
          milestone_days: milestone,
        })

        sent++
      }
    }
  }

  return { processed, sent, skipped, errors }
}
