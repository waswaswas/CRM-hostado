-- Final fix for joining organization - removes all RLS interference
-- Run this in your Supabase SQL Editor

-- Step 1: List and drop ALL policies on organization_members that might interfere
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'organization_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_members', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 2: Recreate the function with maximum explicitness
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
  org_rec RECORD;
  settings_json JSONB;
  stored_code_val TEXT;
  expiration_ts TIMESTAMP WITH TIME ZONE;
  existing_mem RECORD;
  target_org_id UUID;
  perm_org UUID;
  perm_user UUID;
  perm_feat TEXT;
  perm_access BOOLEAN;
BEGIN
  normalized_code := UPPER(TRIM(code_input));
  
  IF normalized_code IS NULL OR LENGTH(normalized_code) != 8 THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, NULL::TEXT, 'Invalid invitation code format'::TEXT;
    RETURN;
  END IF;
  
  FOR org_rec IN
    SELECT o.id AS org_id, o.name AS org_name, o.settings AS org_settings
    FROM public.organizations o
    WHERE o.is_active = true
  LOOP
    settings_json := org_rec.org_settings;
    target_org_id := org_rec.org_id;
    
    IF settings_json IS NOT NULL AND settings_json ? 'invitation_code' THEN
      stored_code_val := UPPER(TRIM(settings_json->>'invitation_code'));
      
      IF stored_code_val = normalized_code THEN
        IF settings_json ? 'invitation_code_expires_at' THEN
          expiration_ts := (settings_json->>'invitation_code_expires_at')::TIMESTAMP WITH TIME ZONE;
          IF expiration_ts < NOW() THEN
            RETURN QUERY SELECT FALSE::BOOLEAN, target_org_id, org_rec.org_name, 'Invitation code has expired'::TEXT;
            RETURN;
          END IF;
        END IF;
        
        SELECT * INTO existing_mem
        FROM public.organization_members om
        WHERE om.organization_id = target_org_id
          AND om.user_id = user_id_input
          AND om.is_active = true
        LIMIT 1;
        
        IF existing_mem IS NOT NULL THEN
          RETURN QUERY SELECT FALSE::BOOLEAN, target_org_id, org_rec.org_name, 'You are already a member of this organization'::TEXT;
          RETURN;
        END IF;
        
        -- Insert member
        INSERT INTO public.organization_members (
          organization_id,
          user_id,
          role,
          joined_at,
          is_active
        ) VALUES (
          target_org_id,
          user_id_input,
          'viewer'::TEXT,
          NOW(),
          true::BOOLEAN
        );
        
        -- Set permissions with explicit variables
        perm_org := target_org_id;
        perm_user := user_id_input;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org, perm_user, 'dashboard'::TEXT, true::BOOLEAN)
        ON CONFLICT (organization_id, user_id, feature) 
        DO UPDATE SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org, perm_user, 'clients'::TEXT, false::BOOLEAN)
        ON CONFLICT (organization_id, user_id, feature) 
        DO UPDATE SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org, perm_user, 'offers'::TEXT, false::BOOLEAN)
        ON CONFLICT (organization_id, user_id, feature) 
        DO UPDATE SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org, perm_user, 'emails'::TEXT, false::BOOLEAN)
        ON CONFLICT (organization_id, user_id, feature) 
        DO UPDATE SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org, perm_user, 'accounting'::TEXT, false::BOOLEAN)
        ON CONFLICT (organization_id, user_id, feature) 
        DO UPDATE SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org, perm_user, 'reminders'::TEXT, false::BOOLEAN)
        ON CONFLICT (organization_id, user_id, feature) 
        DO UPDATE SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org, perm_user, 'settings'::TEXT, false::BOOLEAN)
        ON CONFLICT (organization_id, user_id, feature) 
        DO UPDATE SET has_access = EXCLUDED.has_access;
        
        INSERT INTO public.organization_permissions (organization_id, user_id, feature, has_access)
        VALUES (perm_org, perm_user, 'users'::TEXT, false::BOOLEAN)
        ON CONFLICT (organization_id, user_id, feature) 
        DO UPDATE SET has_access = EXCLUDED.has_access;
        
        RETURN QUERY SELECT TRUE::BOOLEAN, target_org_id, org_rec.org_name, NULL::TEXT;
        RETURN;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, NULL::TEXT, 'Invalid invitation code'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_organization_by_code(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_organization_by_code(TEXT, UUID) TO anon;

