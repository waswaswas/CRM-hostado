-- Diagnostic script to check RLS policies for transactions table
-- Run this to see what policies exist and verify they're set up correctly

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'transactions';

-- List all policies on transactions table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'transactions'
ORDER BY policyname;

-- Check if there are any conflicting policies
SELECT 
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'transactions';



