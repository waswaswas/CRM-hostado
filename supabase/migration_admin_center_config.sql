-- Admin center config: key-value store for login code etc. Service role only (no RLS policies for anon/authenticated).
-- Required env: SUPABASE_SERVICE_ROLE_KEY, ADMIN_CENTER_SESSION_SECRET (for signing admin session cookie).
CREATE TABLE IF NOT EXISTS public.admin_center_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.admin_center_config ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated.
-- Only service_role (used server-side) can access; it bypasses RLS in Supabase.
COMMENT ON TABLE public.admin_center_config IS 'Admin center config (e.g. login code). Access via service_role only.';
