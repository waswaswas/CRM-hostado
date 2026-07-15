'use client'

import type { NotificationPreferences } from '@/lib/notification-preferences'

interface ReminderEmailPreferencesTogglesProps {
  prefs: NotificationPreferences
  onChange: (prefs: NotificationPreferences) => void
  disabled?: boolean
}

/** Master on/off + at due time + 3 days + 7 days */
export function ReminderEmailPreferencesToggles({
  prefs,
  onChange,
  disabled = false,
}: ReminderEmailPreferencesTogglesProps) {
  const emailsOn = prefs.reminder_emails_enabled

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={emailsOn}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...prefs, reminder_emails_enabled: e.target.checked })
          }
        />
        <span>
          <span className="text-sm font-medium block">Email notifications for my reminders</span>
          <span className="text-xs text-muted-foreground">
            Receive emails for your client reminders (at due time and/or when overdue)
          </span>
        </span>
      </label>
      <label className={`flex items-center gap-3 cursor-pointer pl-6 ${!emailsOn ? 'opacity-50' : ''}`}>
        <input
          type="checkbox"
          checked={prefs.reminder_emails_at_due}
          disabled={disabled || !emailsOn}
          onChange={(e) =>
            onChange({ ...prefs, reminder_emails_at_due: e.target.checked })
          }
        />
        <span className="text-sm">
          At due date &amp; time
          <span className="block text-xs text-muted-foreground font-normal">
            When the reminder’s hour and minute are reached
          </span>
        </span>
      </label>
      <label className={`flex items-center gap-3 cursor-pointer pl-6 ${!emailsOn ? 'opacity-50' : ''}`}>
        <input
          type="checkbox"
          checked={prefs.reminder_emails_3_days}
          disabled={disabled || !emailsOn}
          onChange={(e) =>
            onChange({ ...prefs, reminder_emails_3_days: e.target.checked })
          }
        />
        <span className="text-sm">3 days after due date</span>
      </label>
      <label className={`flex items-center gap-3 cursor-pointer pl-6 ${!emailsOn ? 'opacity-50' : ''}`}>
        <input
          type="checkbox"
          checked={prefs.reminder_emails_7_days}
          disabled={disabled || !emailsOn}
          onChange={(e) =>
            onChange({ ...prefs, reminder_emails_7_days: e.target.checked })
          }
        />
        <span className="text-sm">7 days after due date</span>
      </label>
    </div>
  )
}
