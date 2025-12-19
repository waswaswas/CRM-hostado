-- Setup: Add email functionality tables
-- Run this in your Supabase SQL Editor to enable Email functionality

-- Table: email_signatures
CREATE TABLE IF NOT EXISTS email_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  html_content TEXT NOT NULL,
  text_content TEXT,
  
  -- Signature metadata
  include_logo BOOLEAN DEFAULT true,
  include_social_links BOOLEAN DEFAULT false,
  social_links JSONB DEFAULT '{}'::jsonb
);

-- Table: email_templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  category TEXT, -- 'follow_up', 'offer', 'welcome', 'custom'
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  
  -- Template variables (e.g., {{client_name}}, {{offer_amount}})
  variables JSONB DEFAULT '[]'::jsonb,
  
  is_shared BOOLEAN DEFAULT false
);

-- Table: emails
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Email details
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  to_email TEXT NOT NULL,
  to_name TEXT,
  cc_emails TEXT[],
  bcc_emails TEXT[],
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'bounced')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Email provider tracking
  provider_message_id TEXT,
  provider_response JSONB,
  
  -- Signature
  signature_id UUID REFERENCES email_signatures(id),
  
  -- Template
  template_id UUID REFERENCES email_templates(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Update interactions table to link emails
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS email_id UUID REFERENCES emails(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_signatures_owner_id ON email_signatures(owner_id);
CREATE INDEX IF NOT EXISTS idx_email_signatures_default ON email_signatures(owner_id, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_email_templates_owner_id ON email_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

CREATE INDEX IF NOT EXISTS idx_emails_client_id ON emails(client_id);
CREATE INDEX IF NOT EXISTS idx_emails_owner_id ON emails(owner_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at ON emails(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_interactions_email_id ON interactions(email_id);

-- Updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_email_signatures_updated_at ON email_signatures;
CREATE TRIGGER update_email_signatures_updated_at BEFORE UPDATE ON email_signatures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_emails_updated_at ON emails;
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE email_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own email signatures" ON email_signatures;
DROP POLICY IF EXISTS "Users can insert their own email signatures" ON email_signatures;
DROP POLICY IF EXISTS "Users can update their own email signatures" ON email_signatures;
DROP POLICY IF EXISTS "Users can delete their own email signatures" ON email_signatures;

DROP POLICY IF EXISTS "Users can view their own email templates and shared ones" ON email_templates;
DROP POLICY IF EXISTS "Users can insert their own email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can update their own email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can delete their own email templates" ON email_templates;

DROP POLICY IF EXISTS "Users can view their own emails" ON emails;
DROP POLICY IF EXISTS "Users can insert their own emails" ON emails;
DROP POLICY IF EXISTS "Users can update their own emails" ON emails;
DROP POLICY IF EXISTS "Users can delete their own emails" ON emails;

-- Email Signatures Policies
CREATE POLICY "Users can view their own email signatures" ON email_signatures FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert their own email signatures" ON email_signatures FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update their own email signatures" ON email_signatures FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete their own email signatures" ON email_signatures FOR DELETE USING (owner_id = auth.uid());

-- Email Templates Policies
CREATE POLICY "Users can view their own email templates and shared ones" ON email_templates FOR SELECT USING (owner_id = auth.uid() OR is_shared = true);
CREATE POLICY "Users can insert their own email templates" ON email_templates FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update their own email templates" ON email_templates FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete their own email templates" ON email_templates FOR DELETE USING (owner_id = auth.uid());

-- Emails Policies
CREATE POLICY "Users can view their own emails" ON emails FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert their own emails" ON emails FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update their own emails" ON emails FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete their own emails" ON emails FOR DELETE USING (owner_id = auth.uid());






