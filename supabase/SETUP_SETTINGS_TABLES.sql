-- Setup Settings and Status History Tables
-- Copy and paste this entire file into Supabase SQL Editor and run it

-- Table: settings (user-specific settings)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  new_tag_days INTEGER NOT NULL DEFAULT 14,
  custom_statuses JSONB DEFAULT '[]'::jsonb,
  timezone TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Add timezone column if it doesn't exist (for existing installations)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Table: status_change_history (track all status changes)
CREATE TABLE IF NOT EXISTS status_change_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'manual',
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_change_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings
DROP POLICY IF EXISTS "Users can view their own settings" ON settings;
CREATE POLICY "Users can view their own settings"
  ON settings FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON settings;
CREATE POLICY "Users can insert their own settings"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON settings;
CREATE POLICY "Users can update their own settings"
  ON settings FOR UPDATE
  USING (auth.uid() = owner_id);

-- RLS Policies for status_change_history
DROP POLICY IF EXISTS "Users can view status history for their clients" ON status_change_history;
CREATE POLICY "Users can view status history for their clients"
  ON status_change_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = status_change_history.client_id
      AND clients.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert status history for their clients" ON status_change_history;
CREATE POLICY "Users can insert status history for their clients"
  ON status_change_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = status_change_history.client_id
      AND clients.owner_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settings_owner_id ON settings(owner_id);
CREATE INDEX IF NOT EXISTS idx_status_history_client_id ON status_change_history(client_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON status_change_history(created_at);
CREATE INDEX IF NOT EXISTS idx_status_history_change_type ON status_change_history(change_type);

-- Add timezone column to settings if it doesn't exist
ALTER TABLE settings ADD COLUMN IF NOT EXISTS timezone TEXT;















