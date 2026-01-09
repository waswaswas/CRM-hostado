-- Complete solution for safe organization deletion
-- This handles the "Cannot delete owner" error by using proper deletion order
-- Run this in your Supabase SQL Editor

-- Step 1: Check current foreign key constraints and their delete rules
-- (This is informational - run separately if needed)
/*
SELECT 
  tc.constraint_name,
  tc.table_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'organization_members'
  AND ccu.table_name = 'organizations';
*/

-- Step 2: Check for triggers that might prevent deletion
-- (This is informational - run separately if needed)
/*
SELECT 
  tgname AS trigger_name,
  tgenabled AS is_enabled,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.organization_members'::regclass
  AND tgisinternal = false;
*/

-- Step 3: Create the delete function with comprehensive error handling
CREATE OR REPLACE FUNCTION public.delete_organization_safe(org_id UUID, requesting_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_owner_id UUID;
  has_cascade_delete BOOLEAN := false;
  constraint_name TEXT;
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

  -- Check if foreign key constraint has CASCADE DELETE
  -- This would allow us to delete organization first and let CASCADE handle members
  SELECT EXISTS(
    SELECT 1
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'organization_members'
      AND ccu.table_name = 'organizations'
      AND rc.delete_rule = 'CASCADE'
  ) INTO has_cascade_delete;

  -- Delete related data first (these don't have owner restrictions)
  
  -- 1. Delete organization permissions
  DELETE FROM public.organization_permissions
  WHERE organization_id = org_id;

  -- 2. Delete organization invitations
  DELETE FROM public.organization_invitations
  WHERE organization_id = org_id;

  -- 3. Handle organization members deletion
  IF has_cascade_delete THEN
    -- If CASCADE DELETE is set up, delete organization first
    -- This will automatically delete all members via CASCADE
    DELETE FROM public.organizations
    WHERE id = org_id;
  ELSE
    -- No CASCADE DELETE - we need to delete members first
    -- Use a direct approach with SECURITY DEFINER privileges
    
    -- Try to delete all members at once
    -- Using SECURITY DEFINER should bypass RLS, but triggers might still fire
    BEGIN
      DELETE FROM public.organization_members
      WHERE organization_id = org_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- If deletion fails (e.g., due to trigger), try deleting organization first anyway
        -- Some databases might handle it even without explicit CASCADE
        -- Or the error might give us more information
        RAISE EXCEPTION 'Failed to delete organization members: %. Please check for triggers or constraints that prevent owner deletion.', SQLERRM;
    END;

    -- 4. Delete the organization itself
    DELETE FROM public.organizations
    WHERE id = org_id;
  END IF;
  
  -- IMPORTANT: The user account (auth.users) is NEVER deleted
  -- Only organization-related records are removed
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_organization_safe(UUID, UUID) TO authenticated;

-- Step 4: Verify function creation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_organization_safe') THEN
    RAISE NOTICE '✓ Function delete_organization_safe created successfully';
  ELSE
    RAISE EXCEPTION '✗ Function delete_organization_safe was not created';
  END IF;
END $$;
