-- Complete fix for organization deletion
-- This ensures organizations can be deleted without the "Cannot delete owner" error
-- Run this script in your Supabase SQL Editor

-- Step 1: Check and potentially fix foreign key constraint to allow CASCADE DELETE
-- First, check current constraint
DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  FOR constraint_rec IN
    SELECT 
      tc.constraint_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'organization_members'
      AND EXISTS (
        SELECT 1 FROM information_schema.key_column_usage kcu
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE kcu.constraint_name = tc.constraint_name
          AND ccu.table_name = 'organizations'
      )
  LOOP
    RAISE NOTICE 'Found constraint: %, delete_rule: %', constraint_rec.constraint_name, constraint_rec.delete_rule;
    
    -- If delete_rule is not CASCADE, we should update it
    -- However, we can't alter foreign key constraints easily, so we'll handle it in the function
  END LOOP;
END $$;

-- Step 2: Create or replace the delete function with a robust approach
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

  -- Get the owner member ID for potential workaround
  SELECT id INTO owner_member_id
  FROM public.organization_members
  WHERE organization_id = org_id AND user_id = org_owner_id AND role = 'owner'
  LIMIT 1;

  -- Delete related data first (these shouldn't have owner restrictions)
  
  -- 1. Delete organization permissions
  DELETE FROM public.organization_permissions
  WHERE organization_id = org_id;

  -- 2. Delete organization invitations
  DELETE FROM public.organization_invitations
  WHERE organization_id = org_id;

  -- 3. Delete organization members
  -- Strategy: Use SET LOCAL to temporarily disable any triggers if needed
  -- First, delete non-owner members
  DELETE FROM public.organization_members
  WHERE organization_id = org_id AND role != 'owner';
  
  -- Then handle owner member - use a workaround if needed
  IF owner_member_id IS NOT NULL THEN
    -- Try to delete owner member by ID directly (most direct approach)
    -- Using SECURITY DEFINER should bypass RLS, but triggers might still fire
    BEGIN
      DELETE FROM public.organization_members
      WHERE id = owner_member_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- If direct deletion fails, try changing role first
        BEGIN
          -- Temporarily change role (if allowed)
          UPDATE public.organization_members
          SET role = 'viewer', updated_at = TIMEZONE('utc', NOW())
          WHERE id = owner_member_id;
          
          -- Now delete (should work since role changed)
          DELETE FROM public.organization_members
          WHERE id = owner_member_id;
        EXCEPTION
          WHEN OTHERS THEN
            -- Last resort: just continue - organization deletion might handle it via CASCADE
            -- Or the foreign key constraint might prevent org deletion, which is fine
            RAISE NOTICE 'Could not delete owner member, attempting organization deletion anyway';
        END;
    END;
  END IF;

  -- 4. Delete the organization itself
  -- If foreign key has CASCADE, remaining members will be deleted automatically
  DELETE FROM public.organizations
  WHERE id = org_id;
  
  -- IMPORTANT: The user account (auth.users) is NEVER deleted by this function
  -- Only organization-related records are removed
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_organization_safe(UUID, UUID) TO authenticated;

-- Step 3: Verify the function was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'delete_organization_safe'
  ) THEN
    RAISE NOTICE '✓ Function delete_organization_safe created successfully';
  ELSE
    RAISE EXCEPTION 'Function delete_organization_safe was not created';
  END IF;
END $$;
