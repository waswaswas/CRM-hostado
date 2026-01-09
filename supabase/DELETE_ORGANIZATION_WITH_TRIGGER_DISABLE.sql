-- Alternative approach: If ALTER TABLE doesn't work due to permissions,
-- we can modify the trigger to allow deletion when called from this function
-- OR use a different deletion strategy

-- Option 1: Modify the trigger to check a session variable
-- First, let's see if we can drop and recreate the trigger with a condition
-- that allows deletion when the organization is being deleted

-- Check the current trigger definition
SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgname = 'prevent_owner_deletion_trigger';

-- If the above query shows the trigger, we need to:
-- 1. Drop it
-- 2. Recreate it with logic that allows deletion when deleting entire org
-- OR
-- Use the ALTER TABLE approach in the main function (which should work with SECURITY DEFINER)

-- For now, the main DELETE_ORGANIZATION_FUNCTION.sql should work
-- If it doesn't due to ALTER TABLE permissions, use this alternative:

CREATE OR REPLACE FUNCTION public.delete_organization_safe(org_id UUID, requesting_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_owner_id UUID;
  owner_member_id UUID;
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

  -- Delete in correct order
  
  -- 1. Delete organization permissions
  DELETE FROM public.organization_permissions
  WHERE organization_id = org_id;

  -- 2. Delete organization invitations
  DELETE FROM public.organization_invitations
  WHERE organization_id = org_id;

  -- 3. Handle organization members deletion
  -- Strategy: Use direct SQL with EXECUTE to bypass trigger if possible
  -- OR: Delete organization first and rely on CASCADE
  
  -- First, try to temporarily disable trigger
  BEGIN
    EXECUTE 'ALTER TABLE public.organization_members DISABLE TRIGGER prevent_owner_deletion_trigger';
    
    -- Delete all members
    DELETE FROM public.organization_members
    WHERE organization_id = org_id;
    
    -- Re-enable trigger
    EXECUTE 'ALTER TABLE public.organization_members ENABLE TRIGGER prevent_owner_deletion_trigger';
  EXCEPTION
    WHEN insufficient_privilege OR OTHERS THEN
      -- If we can't disable the trigger, try alternative: delete org first if CASCADE exists
      -- OR: Use a workaround by setting a session variable
      RAISE EXCEPTION 'Cannot disable trigger. Please modify prevent_owner_deletion_trigger to allow deletion when deleting entire organization. Error: %', SQLERRM;
  END;

  -- 4. Delete the organization itself
  DELETE FROM public.organizations
  WHERE id = org_id;
  
END;
$$;
