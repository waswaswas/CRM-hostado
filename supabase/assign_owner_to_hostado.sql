-- Migration: Assign waswaswas28@gmail.com as owner of "hostado" organization
-- and assign all data to this organization to be visible
-- 
-- This script:
-- 1. Finds the user by email
-- 2. Finds the "hostado" organization
-- 3. Updates the organization owner_id
-- 4. Ensures the user is a member with 'owner' role
-- 5. Updates all tables to set organization_id for data belonging to this user

DO $$
DECLARE
  target_user_id UUID;
  target_org_id UUID;
BEGIN
  -- Step 1: Get user ID from email (try user_profiles first, then auth.users)
  SELECT id INTO target_user_id
  FROM user_profiles
  WHERE email = 'waswaswas28@gmail.com'
  LIMIT 1;

  -- If not found in user_profiles, try auth.users
  IF target_user_id IS NULL THEN
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'waswaswas28@gmail.com'
    LIMIT 1;
  END IF;

  -- Verify user exists
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email waswaswas28@gmail.com not found';
  END IF;

  -- Step 2: Get organization ID for "hostado"
  SELECT id INTO target_org_id
  FROM organizations
  WHERE slug = 'hostado'
  LIMIT 1;

  -- Verify organization exists
  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization with slug "hostado" not found';
  END IF;

  -- Step 3: Update organization owner
  UPDATE organizations
  SET owner_id = target_user_id,
      updated_at = TIMEZONE('utc', NOW())
  WHERE id = target_org_id;

  RAISE NOTICE 'Updated organization owner to user_id: %', target_user_id;

  -- Step 4: Ensure user is a member with 'owner' role
  -- Check if member already exists
  IF EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = target_org_id AND user_id = target_user_id
  ) THEN
    -- Update existing member
    UPDATE organization_members
    SET role = 'owner',
        is_active = true,
        updated_at = TIMEZONE('utc', NOW())
    WHERE organization_id = target_org_id AND user_id = target_user_id;
    RAISE NOTICE 'Updated user as owner member of organization';
  ELSE
    -- Insert new member
    INSERT INTO organization_members (organization_id, user_id, role, joined_at, is_active)
    VALUES (target_org_id, target_user_id, 'owner', NOW(), true);
    RAISE NOTICE 'Added user as owner member of organization';
  END IF;

  -- Step 5: Update all tables to set organization_id for records belonging to this user
  -- Only update records where organization_id is NULL to avoid overwriting existing assignments
  
  -- Clients
  UPDATE clients
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id 
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated clients';

  -- Client Notes
  UPDATE client_notes
  SET organization_id = target_org_id
  WHERE client_id IN (SELECT id FROM clients WHERE owner_id = target_user_id)
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated client_notes';

  -- Interactions
  UPDATE interactions
  SET organization_id = target_org_id
  WHERE client_id IN (SELECT id FROM clients WHERE owner_id = target_user_id)
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated interactions';

  -- Reminders
  UPDATE reminders
  SET organization_id = target_org_id
  WHERE (client_id IS NULL OR client_id IN (SELECT id FROM clients WHERE owner_id = target_user_id))
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated reminders';

  -- Emails
  UPDATE emails
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated emails';

  -- Email Attachments
  UPDATE email_attachments
  SET organization_id = target_org_id
  WHERE email_id IN (SELECT id FROM emails WHERE owner_id = target_user_id)
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated email_attachments';

  -- Email Templates
  UPDATE email_templates
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated email_templates';

  -- Email Signatures
  UPDATE email_signatures
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated email_signatures';

  -- Offers
  UPDATE offers
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated offers';

  -- Payments
  UPDATE payments
  SET organization_id = target_org_id
  WHERE offer_id IN (SELECT id FROM offers WHERE owner_id = target_user_id)
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated payments';

  -- Accounts
  UPDATE accounts
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated accounts';

  -- Transactions
  UPDATE transactions
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated transactions';

  -- Transaction Categories
  UPDATE transaction_categories
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated transaction_categories';

  -- Accounting Customers
  UPDATE accounting_customers
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated accounting_customers';

  -- Feedback
  UPDATE feedback
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated feedback';

  -- Notifications
  UPDATE notifications
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated notifications';

  -- Settings
  UPDATE settings
  SET organization_id = target_org_id
  WHERE owner_id = target_user_id
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated settings';

  -- Status Change History
  UPDATE status_change_history
  SET organization_id = target_org_id
  WHERE client_id IN (SELECT id FROM clients WHERE owner_id = target_user_id)
    AND (organization_id IS NULL OR organization_id = target_org_id);

  RAISE NOTICE 'Updated status_change_history';

  -- Step 6: Set up organization permissions for owner (all features enabled)
  -- Note: Owners should have all permissions, but we set them explicitly for clarity
  -- Insert each permission separately to handle conflicts properly
  INSERT INTO organization_permissions (organization_id, user_id, feature, has_access)
  VALUES (target_org_id, target_user_id, 'dashboard', true)
  ON CONFLICT (organization_id, user_id, feature) 
  DO UPDATE SET has_access = true;
  
  INSERT INTO organization_permissions (organization_id, user_id, feature, has_access)
  VALUES (target_org_id, target_user_id, 'clients', true)
  ON CONFLICT (organization_id, user_id, feature) 
  DO UPDATE SET has_access = true;
  
  INSERT INTO organization_permissions (organization_id, user_id, feature, has_access)
  VALUES (target_org_id, target_user_id, 'offers', true)
  ON CONFLICT (organization_id, user_id, feature) 
  DO UPDATE SET has_access = true;
  
  INSERT INTO organization_permissions (organization_id, user_id, feature, has_access)
  VALUES (target_org_id, target_user_id, 'emails', true)
  ON CONFLICT (organization_id, user_id, feature) 
  DO UPDATE SET has_access = true;
  
  INSERT INTO organization_permissions (organization_id, user_id, feature, has_access)
  VALUES (target_org_id, target_user_id, 'accounting', true)
  ON CONFLICT (organization_id, user_id, feature) 
  DO UPDATE SET has_access = true;
  
  INSERT INTO organization_permissions (organization_id, user_id, feature, has_access)
  VALUES (target_org_id, target_user_id, 'reminders', true)
  ON CONFLICT (organization_id, user_id, feature) 
  DO UPDATE SET has_access = true;
  
  INSERT INTO organization_permissions (organization_id, user_id, feature, has_access)
  VALUES (target_org_id, target_user_id, 'settings', true)
  ON CONFLICT (organization_id, user_id, feature) 
  DO UPDATE SET has_access = true;
  
  INSERT INTO organization_permissions (organization_id, user_id, feature, has_access)
  VALUES (target_org_id, target_user_id, 'users', true)
  ON CONFLICT (organization_id, user_id, feature) 
  DO UPDATE SET has_access = true;

  RAISE NOTICE 'Set up organization permissions for owner';

  -- Step 7: Verification queries (output for debugging)
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'User ID: %', target_user_id;
  RAISE NOTICE 'Organization ID: %', target_org_id;
  
  -- Verify organization owner
  PERFORM 1 FROM organizations WHERE id = target_org_id AND owner_id = target_user_id;
  IF FOUND THEN
    RAISE NOTICE '✓ Organization owner is correctly set';
  ELSE
    RAISE WARNING '✗ Organization owner NOT set correctly!';
  END IF;
  
  -- Verify membership
  PERFORM 1 FROM organization_members 
  WHERE organization_id = target_org_id 
    AND user_id = target_user_id 
    AND role = 'owner' 
    AND is_active = true;
  IF FOUND THEN
    RAISE NOTICE '✓ User is correctly set as owner member';
  ELSE
    RAISE WARNING '✗ User membership NOT found or incorrect!';
  END IF;
  
  -- Verify permissions exist
  PERFORM 1 FROM organization_permissions 
  WHERE organization_id = target_org_id AND user_id = target_user_id
  LIMIT 1;
  IF FOUND THEN
    RAISE NOTICE '✓ Organization permissions are set';
  ELSE
    RAISE WARNING '✗ Organization permissions NOT found!';
  END IF;

  RAISE NOTICE '=== Migration completed ===';

END $$;
