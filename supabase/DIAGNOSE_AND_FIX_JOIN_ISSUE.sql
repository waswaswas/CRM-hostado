-- Diagnose and fix the ambiguous column reference issue
-- Run this in your Supabase SQL Editor

-- Step 1: List all RLS policies on organization_members to see what might be interfering
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'organization_members'
ORDER BY policyname;

-- Step 2: Drop ALL policies on organization_members that might interfere
-- (We'll recreate only the necessary ones)
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'organization_members'
      AND policyname LIKE '%invitation%' OR policyname LIKE '%join%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_members', policy_record.policyname);
  END LOOP;
END $$;

-- Explicitly drop the problematic policy
DROP POLICY IF EXISTS "Users can join via invitation code" ON public.organization_members;

-- Step 3: Recreate the function with even more explicit references
CREATE OR REPLACE FUNCTION public.join_organization_by_code(
  code_input TEXT,
  user_id_input UUID
)
RETURNS TABLE (
  success BOOLEAN,
  organization_id UUID,
  organization_name TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code TEXT;
  org_record RECORD;
  settings_data JSONB;
  stored_code TEXT;
  expiration_date TIMESTAMP WITH TIME ZONE;
  existing_member RECORD;
  org_id_var UUID;
  perm_org_id UUID;
  perm_user_id UUID;
  perm_feature TEXT;
  perm_has_access BOOLEAN;
BEGIN
  -- Normalize code to uppercase
  normalized_code := UPPER(TRIM(code_input));
  
  -- Check code format
  IF normalized_code IS NULL OR LENGTH(normalized_code) != 8 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Invalid invitation code format'::TEXT;
    RETURN;
  END IF;
  
  -- Search through all active organizations
  FOR org_record IN
    SELECT o.id, o.name, o.settings
    FROM public.organizations o
    WHERE o.is_active = true
  LOOP
    settings_data := org_record.settings;
    org_id_var := org_record.id;
    
    -- Check if invitation code exists in settings
    IF settings_data IS NOT NULL AND settings_data ? 'invitation_code' THEN
      stored_code := UPPER(TRIM(settings_data->>'invitation_code'));
      
      -- Compare codes
      IF stored_code = normalized_code THEN
        -- Check expiration
        IF settings_data ? 'invitation_code_expires_at' THEN
          expiration_date := (settings_data->>'invitation_code_expires_at')::TIMESTAMP WITH TIME ZONE;
          
          IF expiration_date < NOW() THEN
            RETURN QUERY SELECT FALSE, org_id_var, org_record.name, 'Invitation code has expired'::TEXT;
            RETURN;
          END IF;
        END IF;
        
        -- Check if user is already a member
        SELECT * INTO existing_member
        FROM public.organization_members om
        WHERE om.organization_id = org_id_var
          AND om.user_id = user_id_input
          AND om.is_active = true;
        
        IF existing_member IS NOT NULL THEN
          RETURN QUERY SELECT FALSE, org_id_var, org_record.name, 'You are already a member of this organization'::TEXT;
          RETURN;
        END IF;
        
        -- Add user as member with viewer role
        -- Use fully qualified table name and explicit column references
        INSERT INTO public.organization_members (
          organization_id,
          user_id,
          role,
          joined_at,
          is_active
        ) VALUES (
          org_id_var,
          user_id_input,
          'viewer'::TEXT,
          NOW(),
          true
        );
        
        -- Set default permissions - insert one at a time with explicit variables
        perm_org_id := org_id_var;
        perm_user_id := user_id_input;
        
        -- Dashboard permission
        perm_feature := 'dashboard';
        perm_has_access := true;
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org_id, perm_user_id, perm_feature, perm_has_access)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        -- Clients permission
        perm_feature := 'clients';
        perm_has_access := false;
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org_id, perm_user_id, perm_feature, perm_has_access)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        -- Offers permission
        perm_feature := 'offers';
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org_id, perm_user_id, perm_feature, perm_has_access)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        -- Emails permission
        perm_feature := 'emails';
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org_id, perm_user_id, perm_feature, perm_has_access)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        -- Accounting permission
        perm_feature := 'accounting';
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org_id, perm_user_id, perm_feature, perm_has_access)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        -- Reminders permission
        perm_feature := 'reminders';
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org_id, perm_user_id, perm_feature, perm_has_access)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        -- Settings permission
        perm_feature := 'settings';
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org_id, perm_user_id, perm_feature, perm_has_access)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        -- Users permission
        perm_feature := 'users';
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org_id, perm_user_id, perm_feature, perm_has_access)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        RETURN QUERY SELECT TRUE, org_id_var, org_record.name, NULL::TEXT;
        RETURN;
      END IF;
    END IF;
  END LOOP;
  
  -- Code not found
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Invalid invitation code'::TEXT;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.join_organization_by_code(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_organization_by_code(TEXT, UUID) TO anon;

