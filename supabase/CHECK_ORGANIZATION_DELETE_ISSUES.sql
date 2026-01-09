-- Diagnostic script to check what's preventing organization deletion
-- Run this to see what triggers, policies, or constraints might be blocking deletion

-- 1. Check for triggers on organization_members table
SELECT 
  tgname AS trigger_name,
  tgtype::text AS trigger_type,
  tgenabled AS is_enabled,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.organization_members'::regclass
  AND tgisinternal = false;

-- 2. Check RLS policies on organization_members
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'organization_members'
ORDER BY policyname;

-- 3. Check foreign key constraints on organization_members
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'organization_members'
  AND ccu.table_name = 'organizations';

-- 4. Check if the delete_organization_safe function exists
SELECT 
  proname AS function_name,
  proargnames AS argument_names,
  prosrc AS function_body
FROM pg_proc
WHERE proname = 'delete_organization_safe';
