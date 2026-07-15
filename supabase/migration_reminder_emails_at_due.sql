-- Add "at due time" reminder email preference + allow milestone 0
-- Run if you already applied the earlier migration_reminder_email_preferences.sql

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS reminder_emails_at_due boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  ALTER TABLE public.reminder_email_sends
    DROP CONSTRAINT IF EXISTS reminder_email_sends_milestone_days_check;
  ALTER TABLE public.reminder_email_sends
    ADD CONSTRAINT reminder_email_sends_milestone_days_check
    CHECK (milestone_days IN (0, 3, 7));
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN others THEN NULL;
END $$;
