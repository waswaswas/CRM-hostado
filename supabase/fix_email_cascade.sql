-- Fix email cascade deletion issue
-- This changes emails.client_id foreign key from CASCADE to SET NULL
-- This way, emails persist even when clients are deleted, preventing client recreation

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE emails 
DROP CONSTRAINT IF EXISTS emails_client_id_fkey;

-- Step 2: Add the foreign key with ON DELETE SET NULL instead of CASCADE
-- This allows emails to persist even when clients are deleted
ALTER TABLE emails
ADD CONSTRAINT emails_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES clients(id) 
ON DELETE SET NULL;

-- Note: Since client_id is NOT NULL in the current schema, we need to make it nullable first
-- Check if column is already nullable
DO $$ 
BEGIN
  -- Make client_id nullable if it's not already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emails' 
    AND column_name = 'client_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE emails ALTER COLUMN client_id DROP NOT NULL;
  END IF;
END $$;

-- Now add the constraint with SET NULL
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'emails_client_id_fkey' 
    AND table_name = 'emails'
  ) THEN
    ALTER TABLE emails
    ADD CONSTRAINT emails_client_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES clients(id) 
    ON DELETE SET NULL;
  END IF;
END $$;










