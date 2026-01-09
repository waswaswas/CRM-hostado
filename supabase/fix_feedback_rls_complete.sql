-- Complete fix for feedback table RLS policies
-- This script fixes the "new row violates row-level security policy" error
-- Run this in your Supabase SQL Editor

-- Step 1: Ensure organization_id column exists (if not already added)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'feedback' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.feedback 
    ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
    
    RAISE NOTICE 'Added organization_id column to feedback table';
  ELSE
    RAISE NOTICE 'organization_id column already exists';
  END IF;
END $$;

-- Step 2: Drop ALL existing policies (idempotent)
DO $$ 
DECLARE
  r RECORD;
  policy_count INTEGER := 0;
BEGIN
  -- Drop all policies on feedback table
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'feedback' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.feedback', r.policyname);
    policy_count := policy_count + 1;
  END LOOP;
  
  IF policy_count > 0 THEN
    RAISE NOTICE 'Dropped % existing policy/policies', policy_count;
  ELSE
    RAISE NOTICE 'No existing policies to drop';
  END IF;
END $$;

-- Step 3: Ensure RLS is enabled
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Step 4: Recreate RLS Policies for feedback
-- Using the same pattern as other working tables (clients, offers, etc.)

-- SELECT policy - users can view their own feedback
CREATE POLICY "Users can view their own feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- INSERT policy - this is the one that was failing
-- Allow insert if user is authenticated and owner_id matches
CREATE POLICY "Users can insert their own feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND owner_id = auth.uid()
  );

-- UPDATE policy - users can update their own feedback
CREATE POLICY "Users can update their own feedback"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE policy - users can delete their own feedback
CREATE POLICY "Users can delete their own feedback"
  ON public.feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Step 5: Verify policies were created
SELECT 
  policyname,
  cmd as command,
  roles,
  CASE WHEN qual IS NOT NULL THEN 'YES' ELSE 'NO' END as has_using,
  CASE WHEN with_check IS NOT NULL THEN 'YES' ELSE 'NO' END as has_with_check
FROM pg_policies 
WHERE tablename = 'feedback' AND schemaname = 'public'
ORDER BY policyname;

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE 'Feedback RLS policies fixed successfully!';
END $$;
