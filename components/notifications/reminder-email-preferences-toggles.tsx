'use client'

import type { NotificationPreferences } from '@/lib/notification-preferences'

interface ReminderEmailPreferencesTogglesProps {
  prefs: NotificationPreferences
  onChange: (prefs: NotificationPreferences) => void
  disabled?: boolean
}

/** Three toggles: master on/off, 3 days after due, 7 days after due */
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
            Receive emails when your client reminders are still open past the due date
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
