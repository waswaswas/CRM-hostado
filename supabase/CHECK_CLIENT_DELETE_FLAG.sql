-- Check that the client soft-delete flag (and related objects) exist.
-- Run in Supabase SQL Editor.

-- 1) Columns is_deleted and deleted_at on public.clients
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
  AND column_name IN ('is_deleted', 'deleted_at')
ORDER BY column_name;

-- 2) Index clients_org_deleted_idx
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'clients'
  AND indexname = 'clients_org_deleted_idx';

-- 3) RLS policy for org owner/admin update (optional)
SELECT
  policyname,
  cmd,
  qual::text AS using_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'clients'
  AND policyname = 'org_owner_admin_update_clients';

-- 4) Counts: total clients, not deleted, deleted
SELECT
  COUNT(*) FILTER (WHERE COALESCE(is_deleted, false) = false) AS active_clients,
  COUNT(*) FILTER (WHERE is_deleted = true) AS deleted_clients,
  COUNT(*) AS total_clients
FROM public.clients;
