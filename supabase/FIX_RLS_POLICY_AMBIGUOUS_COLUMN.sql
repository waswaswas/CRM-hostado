-- Fix ambiguous column reference in RLS policy
-- Run this in your Supabase SQL Editor to fix the "column reference 'organization_id' is ambiguous" error
-- 
-- Since we have a SECURITY DEFINER function (join_organization_by_code) that bypasses RLS,
-- the function handles all validation and insertion. We'll remove the problematic RLS policy.

DROP POLICY IF EXISTS "Users can join via invitation code" ON public.organization_members;

-- The SECURITY DEFINER function bypasses RLS, so no policy is needed.
-- If you need a policy for direct inserts (not recommended), you would need to create
-- a simpler one, but since the function handles everything, we don't need it.

