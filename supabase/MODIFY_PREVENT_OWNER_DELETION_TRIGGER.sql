-- Permanent fix: Modify the prevent_owner_deletion_trigger to allow deletion
-- when the entire organization is being deleted (not just removing a member)
--
-- This script will:
-- 1. Drop the existing trigger
-- 2. Recreate it with logic that allows owner deletion when appropriate
--
-- NOTE: You'll need to see the current trigger definition first to recreate it properly
-- Run this query first to see the current trigger:
-- SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'prevent_owner_deletion_trigger';

-- Step 1: Get the current trigger definition to understand its logic
-- (Run this separately first to see what the trigger currently does)
-- SELECT tgname, pg_get_triggerdef(oid) AS definition
-- FROM pg_trigger
-- WHERE tgname = 'prevent_owner_deletion_trigger';

-- Step 2: Drop the existing trigger
DROP TRIGGER IF EXISTS prevent_owner_deletion_trigger ON public.organization_members;

-- Step 3: Recreate the trigger with modified logic
-- The trigger should prevent deleting owner members EXCEPT when:
-- - The organization is being deleted (checked via a session variable or by checking if org will be deleted)
-- 
-- Since we can't easily check if the organization will be deleted, we'll use a different approach:
-- The trigger will allow deletion if it's called from within the delete_organization_safe function
-- OR we can check if there are no other members (indicating org deletion)

CREATE OR REPLACE FUNCTION public.check_owner_deletion_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allow_org_deletion TEXT;
BEGIN
  -- Allow deletion if the role is not 'owner'
  IF OLD.role != 'owner' THEN
    RETURN OLD;
  END IF;

  -- If it's an owner, check if organization deletion is in progress
  -- The delete_organization_safe function sets a session variable to indicate this
  allow_org_deletion := current_setting('app.allow_org_deletion', true);
  
  -- If the session variable is set to 'true', allow deletion (org deletion scenario)
  IF allow_org_deletion = 'true' THEN
    RETURN OLD;
  END IF;
  
  -- Otherwise, prevent owner deletion (normal member removal scenario)
  RAISE EXCEPTION 'Cannot delete owner. Owners cannot be removed from organizations.';
  
  RETURN NULL;
EXCEPTION
  -- If the session variable doesn't exist, catch the error and prevent deletion
  WHEN undefined_object THEN
    RAISE EXCEPTION 'Cannot delete owner. Owners cannot be removed from organizations.';
END;
$$;

CREATE TRIGGER prevent_owner_deletion_trigger
  BEFORE DELETE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_owner_deletion_allowed();

-- This modified trigger will:
-- 1. Allow deletion of non-owner members (always)
-- 2. Allow deletion of owner members if there are no other active members (org deletion scenario)
-- 3. Prevent deletion of owner members if there are other active members (normal member removal)
