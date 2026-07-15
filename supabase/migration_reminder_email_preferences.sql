-- Reminder email notification preferences (user settings)
-- Run in Supabase SQL Editor

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS reminder_emails_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_emails_3_days boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_emails_7_days boolean NOT NULL DEFAULT true;

-- Track which milestone emails were already sent per reminder+user
CREATE TABLE IF NOT EXISTS public.reminder_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_days integer NOT NULL CHECK (milestone_days IN (3, 7)),
  UNIQUE (reminder_id, user_id, milestone_days)
);

CREATE INDEX IF NOT EXISTS idx_reminder_email_sends_user
  ON public.reminder_email_sends(user_id);

ALTER TABLE public.reminder_email_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_email_sends_select_own" ON public.reminder_email_sends;
CREATE POLICY "reminder_email_sends_select_own"
  ON public.reminder_email_sends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
