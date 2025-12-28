-- Comprehensive fix for RLS policies on transactions table
-- This script will completely reset and recreate the policies

-- Step 1: Drop ALL existing policies (using a more aggressive approach)
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Get all policy names for transactions table
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'transactions'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON transactions', r.policyname);
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP;
END $$;

-- Step 2: Ensure RLS is enabled
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policies with explicit role specification
-- Using the exact same pattern as offers table which works

CREATE POLICY "Users can view their own transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- INSERT policy - this is critical for creating transactions
-- The WITH CHECK ensures the owner_id matches the authenticated user
CREATE POLICY "Users can insert their own transactions"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND owner_id = auth.uid()
  );

CREATE POLICY "Users can update their own transactions"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own transactions"
  ON transactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Step 4: Verify the policies
SELECT 
  policyname,
  cmd as command,
  roles,
  CASE WHEN qual IS NOT NULL THEN 'YES' ELSE 'NO' END as has_using,
  CASE WHEN with_check IS NOT NULL THEN 'YES' ELSE 'NO' END as has_with_check
FROM pg_policies 
WHERE tablename = 'transactions'
ORDER BY policyname;


