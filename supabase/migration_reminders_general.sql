-- Migration: Allow reminders without a client (General reminders)
-- This makes client_id nullable in the reminders table and updates RLS policies

-- Step 1: Make client_id nullable
ALTER TABLE reminders 
ALTER COLUMN client_id DROP NOT NULL;

-- Step 2: Update the foreign key constraint to allow NULL
-- First, drop the existing constraint if it exists
ALTER TABLE reminders 
DROP CONSTRAINT IF EXISTS reminders_client_id_fkey;

-- Re-add the foreign key with ON DELETE SET NULL (allows NULL values)
ALTER TABLE reminders
ADD CONSTRAINT reminders_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES clients(id) 
ON DELETE SET NULL;

-- Step 3: Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view reminders for their clients" ON reminders;
DROP POLICY IF EXISTS "Users can insert reminders for their clients" ON reminders;
DROP POLICY IF EXISTS "Users can update reminders for their clients" ON reminders;
DROP POLICY IF EXISTS "Users can delete reminders for their clients" ON reminders;

-- Step 4: Create new RLS policies that allow general reminders (null client_id)
-- SELECT: Allow viewing reminders where client_id is null OR client belongs to user
CREATE POLICY "Users can view their reminders"
  ON reminders FOR SELECT
  TO authenticated
  USING (
    reminders.client_id IS NULL
    OR EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = reminders.client_id
      AND clients.owner_id = auth.uid()
    )
  );

-- INSERT: Allow inserting reminders where client_id is null OR client belongs to user
CREATE POLICY "Users can insert their reminders"
  ON reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      reminders.client_id IS NULL
      OR EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = reminders.client_id
        AND clients.owner_id = auth.uid()
      )
    )
  );

-- UPDATE: Allow updating reminders where client_id is null OR client belongs to user
CREATE POLICY "Users can update their reminders"
  ON reminders FOR UPDATE
  TO authenticated
  USING (
    reminders.client_id IS NULL
    OR EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = reminders.client_id
      AND clients.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    reminders.client_id IS NULL
    OR EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = reminders.client_id
      AND clients.owner_id = auth.uid()
    )
  );

-- DELETE: Allow deleting reminders where client_id is null OR client belongs to user
CREATE POLICY "Users can delete their reminders"
  ON reminders FOR DELETE
  TO authenticated
  USING (
    reminders.client_id IS NULL
    OR EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = reminders.client_id
      AND clients.owner_id = auth.uid()
    )
  );

-- Note: This allows reminders to exist without a client, useful for general reminders
-- that are not tied to a specific client. The RLS policies now allow:
-- - General reminders (client_id IS NULL) for any authenticated user
-- - Client-specific reminders where the client belongs to the user













