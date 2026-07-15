export interface NotificationPreferences {
  reminders_enabled: boolean
  reminders_include_completed: boolean
  contacts_enabled: boolean
  tasks_enabled: boolean
  /** Master switch for overdue reminder emails to the user */
  reminder_emails_enabled: boolean
  /** Email when reminder is 3+ days overdue */
  reminder_emails_3_days: boolean
  /** Email when reminder is 7+ days overdue */
  reminder_emails_7_days: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  reminders_enabled: true,
  reminders_include_completed: true,
  contacts_enabled: true,
  tasks_enabled: true,
  reminder_emails_enabled: false,
  reminder_emails_3_days: true,
  reminder_emails_7_days: true,
}

export function normalizeNotificationPreferences(
  data: Record<string, unknown> | null | undefined
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(data || {}),
    reminder_emails_enabled: Boolean(data?.reminder_emails_enabled ?? false),
    reminder_emails_3_days: data?.reminder_emails_3_days !== false,
    reminder_emails_7_days: data?.reminder_emails_7_days !== false,
  }
}
