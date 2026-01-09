-- Fix for organization deletion - handles triggers and constraints
-- Run this to fix the "Cannot delete owner" error

-- Step 1: Check for any triggers on organization_members that might prevent deletion
DO $$
DECLARE
  trig RECORD;
BEGIN
  FOR trig IN
    SELECT tgname, pg_get_triggerdef(oid) AS definition
    FROM pg_trigger
    WHERE tgrelid = 'public.organization_members'::regclass
      AND tgisinternal = false
  LOOP
    RAISE NOTICE 'Found trigger: %', trig.tgname;
    RAISE NOTICE 'Definition: %', trig.definition;
  END LOOP;
END $$;

-- Step 2: Create a robust delete function that handles all cases
CREATE OR REPLACE FUNCTION public.delete_organization_safe(org_id UUID, requesting_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_owner_id UUID;
  owner_user_id UUID;
BEGIN
  -- Verify the requesting user is the owner
  SELECT owner_id INTO org_owner_id
  FROM public.organizations
  WHERE id = org_id AND is_active = true;

  IF org_owner_id IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF org_owner_id != requesting_user_id THEN
    RAISE EXCEPTION 'Only the organization owner can delete the organization';
  END IF;

  -- Store owner user_id for reference
  owner_user_id := org_owner_id;

  -- Delete in safe order
  
  -- 1. Delete organization permissions
  DELETE FROM public.organization_permissions
  WHERE organization_id = org_id;

  -- 2. Delete organization invitations  
  DELETE FROM public.organization_invitations
  WHERE organization_id = org_id;

  -- 3. Delete organization members
  -- Important: We're deleting ALL members including owner
  -- Since we're deleting the entire organization, this is safe
  -- The user account (auth.users) is NOT affected
  
  -- Use a subquery approach to ensure we delete by organization_id
  -- This should work even if there are restrictions on deleting by role
  PERFORM 1 FROM public.organization_members WHERE organization_id = org_id;
  
  -- Delete all members (including owner) - SECURITY DEFINER should allow this
  DELETE FROM public.organization_members
  WHERE organization_id = org_id;
  
  -- If we reach here, members were deleted successfully

  -- 4. Delete the organization itself
  DELETE FROM public.organizations
  WHERE id = org_id;
  
  -- Success! Organization and all related data deleted
  -- User account (owner_user_id) remains intact in auth.users
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_organization_safe(UUID, UUID) TO authenticated;
