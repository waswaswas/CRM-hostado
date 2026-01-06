-- Function to validate invitation codes
-- This function bypasses RLS to allow code validation for non-members
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.validate_invitation_code(code_input TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  organization_id UUID,
  organization_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_code TEXT;
  org_record RECORD;
  settings_data JSONB;
  stored_code TEXT;
  expiration_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Normalize code to uppercase
  normalized_code := UPPER(TRIM(code_input));
  
  -- Check code format
  IF normalized_code IS NULL OR LENGTH(normalized_code) != 8 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE, 'Invalid invitation code format'::TEXT;
    RETURN;
  END IF;
  
  -- Search through all active organizations
  FOR org_record IN
    SELECT id, name, settings
    FROM public.organizations
    WHERE is_active = true
  LOOP
    settings_data := org_record.settings;
    
    -- Check if invitation code exists in settings
    IF settings_data IS NOT NULL AND settings_data ? 'invitation_code' THEN
      stored_code := UPPER(TRIM(settings_data->>'invitation_code'));
      
      -- Compare codes
      IF stored_code = normalized_code THEN
        -- Check expiration
        IF settings_data ? 'invitation_code_expires_at' THEN
          expiration_date := (settings_data->>'invitation_code_expires_at')::TIMESTAMP WITH TIME ZONE;
          
          IF expiration_date < NOW() THEN
            RETURN QUERY SELECT FALSE, org_record.id, org_record.name, expiration_date, 'Invitation code has expired'::TEXT;
            RETURN;
          END IF;
          
          RETURN QUERY SELECT TRUE, org_record.id, org_record.name, expiration_date, NULL::TEXT;
          RETURN;
        ELSE
          -- No expiration set, code is valid
          RETURN QUERY SELECT TRUE, org_record.id, org_record.name, NULL::TIMESTAMP WITH TIME ZONE, NULL::TEXT;
          RETURN;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  -- Code not found
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE, 'Invalid invitation code'::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_invitation_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invitation_code(TEXT) TO anon;

