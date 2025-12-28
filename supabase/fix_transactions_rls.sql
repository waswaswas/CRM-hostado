-- Fix RLS policies for transactions table
-- Run this in Supabase SQL Editor to fix the "new row violates row-level security policy" error
-- IMPORTANT: Make sure you're logged in as the database owner or have admin privileges

-- Step 1: Drop ALL existing policies (idempotent)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Drop all policies on transactions table
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'transactions') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON transactions', r.policyname);
  END LOOP;
END $$;

-- Step 2: Ensure RLS is enabled
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 3: Recreate RLS Policies for transactions
-- Using the same pattern as other working tables (offers, clients, etc.)

-- SELECT policy
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- INSERT policy (this is the one that's failing)
CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE policy
CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE policy
CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Step 4: Verify policies were created
SELECT 
  policyname,
  cmd as command,
  CASE WHEN qual IS NOT NULL THEN 'YES' ELSE 'NO' END as has_using,
  CASE WHEN with_check IS NOT NULL THEN 'YES' ELSE 'NO' END as has_with_check
FROM pg_policies 
WHERE tablename = 'transactions'
ORDER BY policyname;


