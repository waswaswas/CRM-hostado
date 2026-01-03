-- Migration: Fix interactions.email_id foreign key to allow CASCADE delete
-- This fixes the issue where clients with emails cannot be deleted
-- because interactions reference emails without CASCADE

-- Step 1: Drop the existing foreign key constraint if it exists
ALTER TABLE interactions 
  DROP CONSTRAINT IF EXISTS interactions_email_id_fkey;

-- Step 2: Re-add the foreign key with ON DELETE CASCADE
ALTER TABLE interactions 
  ADD CONSTRAINT interactions_email_id_fkey 
  FOREIGN KEY (email_id) 
  REFERENCES emails(id) 
  ON DELETE CASCADE;

-- This ensures that when an email is deleted (e.g., when a client is deleted),
-- all interactions referencing that email will also be automatically deleted.

















