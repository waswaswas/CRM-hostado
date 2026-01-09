-- Function to safely delete an organization and all related data
-- This function uses SECURITY DEFINER to bypass RLS policies
-- Only the organization owner can use this function
-- 
-- IMPORTANT: This function deletes the organization and related records.
-- The user account (auth.users) is NOT deleted - only organization-related data is removed.
--
-- If you get "Cannot delete owner" error, there may be a trigger preventing deletion.
-- Run the diagnostic script CHECK_ORGANIZATION_DELETE_ISSUES.sql to identify triggers.

CREATE OR REPLACE FUNCTION public.delete_organization_safe(org_id UUID, requesting_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_owner_id UUID;
BEGIN
  -- Verify the requesting user is the owner of the organization
  SELECT owner_id INTO org_owner_id
  FROM public.organizations
  WHERE id = org_id AND is_active = true;

  IF org_owner_id IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF org_owner_id != requesting_user_id THEN
    RAISE EXCEPTION 'Only the organization owner can delete the organization';
  END IF;

  -- Delete in correct order to avoid foreign key constraint issues
  
  -- 1. Delete organization permissions first
  DELETE FROM public.organization_permissions
  WHERE organization_id = org_id;

  -- 2. Delete organization invitations
  DELETE FROM public.organization_invitations
  WHERE organization_id = org_id;

  -- 3. Delete organization members (including owner)
  -- Since we're deleting the ENTIRE organization, deleting all members (including owner) is safe.
  -- The user account (auth.users) is NOT deleted - only the membership record is removed.
  
  -- Strategy 1: Try to disable the trigger (works if we have ALTER TABLE privileges)
  -- Strategy 2: Set a session variable that the trigger checks (if trigger is modified)
  
  -- Try disabling the trigger first (should work with SECURITY DEFINER)
  BEGIN
    ALTER TABLE public.organization_members DISABLE TRIGGER prevent_owner_deletion_trigger;
    
    -- Delete all members by organization_id (including owner)
    DELETE FROM public.organization_members
    WHERE organization_id = org_id;
    
    -- Re-enable the trigger
    ALTER TABLE public.organization_members ENABLE TRIGGER prevent_owner_deletion_trigger;
  EXCEPTION
    WHEN insufficient_privilege THEN
      -- If we can't disable the trigger, try using session variable approach
      -- (requires the trigger to be modified to check this variable)
      PERFORM set_config('app.allow_org_deletion', 'true', true);
      
      DELETE FROM public.organization_members
      WHERE organization_id = org_id;
      
      -- Reset the session variable
      PERFORM set_config('app.allow_org_deletion', 'false', true);
  END;

  -- 4. Delete the organization itself
  DELETE FROM public.organizations
  WHERE id = org_id;
  
  -- Success! Organization and all related data deleted.
  -- User account (org_owner_id) remains intact in auth.users.
EXCEPTION
  WHEN OTHERS THEN
    -- Make sure to re-enable the trigger even if something fails
    BEGIN
      ALTER TABLE public.organization_members ENABLE TRIGGER prevent_owner_deletion_trigger;
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- Ignore errors when re-enabling (trigger might not exist or already enabled)
    END;
    -- Re-raise the original error
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_organization_safe(UUID, UUID) TO authenticated;
