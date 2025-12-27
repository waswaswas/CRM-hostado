-- Verification script for accounting tables
-- Run this after migration_accounting.sql to verify everything was created correctly

-- Check if tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('accounts', 'transactions', 'transaction_categories') THEN '✓ Exists'
    ELSE '✗ Missing'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('accounts', 'transactions', 'transaction_categories')
ORDER BY table_name;

-- Check if RLS is enabled
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✓ Enabled'
    ELSE '✗ Disabled'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('accounts', 'transactions', 'transaction_categories')
ORDER BY tablename;

-- Check if indexes exist
SELECT 
  indexname,
  tablename,
  CASE 
    WHEN indexname LIKE 'idx_%' THEN '✓ Exists'
    ELSE '✗ Missing'
  END as status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('accounts', 'transactions', 'transaction_categories')
ORDER BY tablename, indexname;

-- Check if trigger exists
SELECT 
  trigger_name,
  event_object_table,
  CASE 
    WHEN trigger_name = 'trigger_update_account_balance' THEN '✓ Exists'
    ELSE '✗ Missing'
  END as status
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
AND event_object_table = 'transactions'
ORDER BY trigger_name;

-- Check if function exists
SELECT 
  routine_name,
  CASE 
    WHEN routine_name IN ('update_account_balance', 'initialize_default_categories') THEN '✓ Exists'
    ELSE '✗ Missing'
  END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('update_account_balance', 'initialize_default_categories')
ORDER BY routine_name;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN policyname IS NOT NULL THEN '✓ Exists'
    ELSE '✗ Missing'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('accounts', 'transactions', 'transaction_categories')
ORDER BY tablename, policyname;

-- Check constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  CASE 
    WHEN tc.constraint_name IS NOT NULL THEN '✓ Exists'
    ELSE '✗ Missing'
  END as status
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public' 
AND tc.table_name IN ('accounts', 'transactions', 'transaction_categories')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
