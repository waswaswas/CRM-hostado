-- Complete fix for joining organization via invitation code
-- This removes all problematic RLS policies and ensures the function works
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the problematic RLS policy
DROP POLICY IF EXISTS "Users can join via invitation code" ON public.organization_members;

-- Step 2: Check and recreate the function to ensure it's correct
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
    SELECT id, name, settings
    FROM public.organizations
    WHERE is_active = true
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
        FROM public.organization_members
        WHERE organization_id = org_id_var
          AND user_id = user_id_input
          AND is_active = true;
        
        IF existing_member IS NOT NULL THEN
          RETURN QUERY SELECT FALSE, org_id_var, org_record.name, 'You are already a member of this organization'::TEXT;
          RETURN;
        END IF;
        
        -- Add user as member with viewer role
        -- Use explicit column names to avoid any ambiguity
        INSERT INTO public.organization_members (
          organization_id,
          user_id,
          role,
          joined_at,
          is_active
        ) VALUES (
          org_id_var,
          user_id_input,
          'viewer',
          NOW(),
          true
        );
        
        -- Set default permissions - only dashboard access
        -- Insert each permission separately to avoid ON CONFLICT ambiguity
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (org_id_var, user_id_input, 'dashboard', true)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (org_id_var, user_id_input, 'clients', false)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (org_id_var, user_id_input, 'offers', false)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (org_id_var, user_id_input, 'emails', false)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (org_id_var, user_id_input, 'accounting', false)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (org_id_var, user_id_input, 'reminders', false)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (org_id_var, user_id_input, 'settings', false)
        ON CONFLICT (organization_id, user_id, feature) DO UPDATE
        SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (org_id_var, user_id_input, 'users', false)
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

-- Step 3: List all existing policies on organization_members to check for conflicts
-- (This is just for reference - you can check this manually if needed)
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies 
-- WHERE tablename = 'organization_members';

