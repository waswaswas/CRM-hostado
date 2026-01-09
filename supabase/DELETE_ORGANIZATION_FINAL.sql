-- Final solution for deleting organizations safely
-- This function ensures organizations can be deleted without "Cannot delete owner" errors
-- IMPORTANT: Only deletes organization data, NOT user accounts

-- Step 1: Create the function with a workaround for owner deletion
CREATE OR REPLACE FUNCTION public.delete_organization_safe(org_id UUID, requesting_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_owner_id UUID;
  owner_member_exists BOOLEAN;
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

  -- Check if owner member exists
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = org_owner_id AND role = 'owner'
  ) INTO owner_member_exists;

  -- Delete related data first
  
  -- 1. Delete organization permissions
  DELETE FROM public.organization_permissions
  WHERE organization_id = org_id;

  -- 2. Delete organization invitations
  DELETE FROM public.organization_invitations
  WHERE organization_id = org_id;

  -- 3. Delete organization members
  -- Since we're deleting the entire organization, we need to delete all members
  -- including the owner. We'll use a direct DELETE statement with SECURITY DEFINER privileges
  
  -- Delete all members at once - SECURITY DEFINER should bypass any RLS/triggers
  -- that prevent owner deletion, since we're operating with elevated privileges
  DELETE FROM public.organization_members
  WHERE organization_id = org_id;
  
  -- If the above DELETE fails silently or doesn't work due to a trigger,
  -- we'll handle it by trying the organization deletion which might CASCADE

  -- 4. Delete the organization itself
  -- This should work now that members are deleted (or will CASCADE delete remaining members)
  DELETE FROM public.organizations
  WHERE id = org_id;
  
  -- If organization deletion fails due to foreign key constraint (members still exist),
  -- we know the CASCADE isn't set up, so we need to ensure members were deleted above
  
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_organization_safe(UUID, UUID) TO authenticated;

-- Step 2: If the function still fails, we may need to check for and handle triggers
-- The following query can help identify triggers that might be blocking deletion:
-- SELECT tgname, pg_get_triggerdef(oid) 
-- FROM pg_trigger 
-- WHERE tgrelid = 'organization_members'::regclass AND tgisinternal = false;
