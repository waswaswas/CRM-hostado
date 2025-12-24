-- Setup: Add email attachments functionality
-- Run this in your Supabase SQL Editor to enable email attachments

-- Table: email_attachments
CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  email_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  CONSTRAINT email_attachments_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.emails(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);

-- Enable RLS
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view attachments for their emails" ON email_attachments;
DROP POLICY IF EXISTS "Users can insert attachments for their emails" ON email_attachments;
DROP POLICY IF EXISTS "Users can delete attachments for their emails" ON email_attachments;

CREATE POLICY "Users can view attachments for their emails" 
  ON email_attachments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM emails 
      WHERE emails.id = email_attachments.email_id 
      AND emails.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments for their emails" 
  ON email_attachments FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emails 
      WHERE emails.id = email_attachments.email_id 
      AND emails.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments for their emails" 
  ON email_attachments FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM emails 
      WHERE emails.id = email_attachments.email_id 
      AND emails.owner_id = auth.uid()
    )
  );

-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-attachments',
  'email-attachments',
  false,
  26214400, -- 25MB
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for email-attachments bucket
DROP POLICY IF EXISTS "Users can upload attachments for their emails" ON storage.objects;
DROP POLICY IF EXISTS "Users can view attachments for their emails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete attachments for their emails" ON storage.objects;

CREATE POLICY "Users can upload attachments for their emails"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'email-attachments' AND
    (
      EXISTS (
        SELECT 1 FROM emails
        WHERE emails.id::text = (string_to_array(name, '/'))[2]
        AND emails.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view attachments for their emails"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'email-attachments' AND
    (
      EXISTS (
        SELECT 1 FROM emails
        WHERE emails.id::text = (string_to_array(name, '/'))[2]
        AND emails.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete attachments for their emails"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'email-attachments' AND
    (
      EXISTS (
        SELECT 1 FROM emails
        WHERE emails.id::text = (string_to_array(name, '/'))[2]
        AND emails.owner_id = auth.uid()
      )
    )
  );


