-- Migration: Add inbox functionality to emails table
-- Run this in your Supabase SQL Editor to enable inbox features

-- Add new columns to emails table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IS NULL OR direction = ANY (ARRAY['inbound'::text, 'outbound'::text]));
ALTER TABLE emails ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'inbox' CHECK (folder = ANY (ARRAY['inbox'::text, 'sent'::text, 'draft'::text, 'trash'::text]));
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS in_reply_to UUID REFERENCES emails(id);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS forwarded_from UUID REFERENCES emails(id);

-- Set default direction for existing emails based on status
UPDATE emails SET direction = 'outbound' WHERE direction IS NULL;

-- Set default folder for existing emails
UPDATE emails SET folder = 'sent' WHERE status = 'sent' AND folder = 'inbox';
UPDATE emails SET folder = 'draft' WHERE status = 'draft' AND folder = 'inbox';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_emails_direction ON emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_emails_deleted_at ON emails(deleted_at) WHERE is_deleted = true;
CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to ON emails(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_emails_forwarded_from ON emails(forwarded_from);

-- Function to automatically delete emails from trash after 150 days
CREATE OR REPLACE FUNCTION cleanup_trash_emails()
RETURNS void AS $$
BEGIN
  DELETE FROM emails
  WHERE is_deleted = true
    AND deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '150 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job (requires pg_cron extension)
-- Note: This requires pg_cron extension to be enabled in Supabase
-- You may need to run this manually or set up a cron job externally
-- SELECT cron.schedule('cleanup-trash-emails', '0 2 * * *', 'SELECT cleanup_trash_emails()');



