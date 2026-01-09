-- Diagnostic script to verify owner assignment
-- Run this to check the current state and identify any issues

DO $$
DECLARE
  target_user_id UUID;
  target_org_id UUID;
  member_count INTEGER;
  permission_count INTEGER;
  org_owner_id UUID;
BEGIN
  -- Find user
  SELECT id INTO target_user_id
  FROM user_profiles
  WHERE email = 'waswaswas28@gmail.com'
  LIMIT 1;

  IF target_user_id IS NULL THEN
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'waswaswas28@gmail.com'
    LIMIT 1;
  END IF;

  IF target_user_id IS NULL THEN
    RAISE NOTICE '❌ User waswaswas28@gmail.com NOT FOUND';
    RETURN;
  END IF;

  RAISE NOTICE '✓ User found: %', target_user_id;

  -- Find organization
  SELECT id INTO target_org_id
  FROM organizations
  WHERE slug = 'hostado'
  LIMIT 1;

  IF target_org_id IS NULL THEN
    RAISE NOTICE '❌ Organization "hostado" NOT FOUND';
    RETURN;
  END IF;

  RAISE NOTICE '✓ Organization found: %', target_org_id;

  -- Check organization owner
  SELECT owner_id INTO org_owner_id
  FROM organizations
  WHERE id = target_org_id;

  IF org_owner_id = target_user_id THEN
    RAISE NOTICE '✓ Organization owner is correctly set to target user';
  ELSE
    RAISE NOTICE '❌ Organization owner is set to: % (should be: %)', org_owner_id, target_user_id;
  END IF;

  -- Check membership
  SELECT COUNT(*) INTO member_count
  FROM organization_members
  WHERE organization_id = target_org_id
    AND user_id = target_user_id
    AND role = 'owner'
    AND is_active = true;

  IF member_count > 0 THEN
    RAISE NOTICE '✓ User is correctly set as owner member (count: %)', member_count;
  ELSE
    RAISE NOTICE '❌ User is NOT set as owner member';
    
    -- Check if member exists with different role
    SELECT COUNT(*) INTO member_count
    FROM organization_members
    WHERE organization_id = target_org_id
      AND user_id = target_user_id;
    
    IF member_count > 0 THEN
      RAISE NOTICE '   (But user IS a member - check role/active status)';
    ELSE
      RAISE NOTICE '   (User is NOT a member at all)';
    END IF;
  END IF;

  -- Check permissions
  SELECT COUNT(*) INTO permission_count
  FROM organization_permissions
  WHERE organization_id = target_org_id
    AND user_id = target_user_id
    AND has_access = true;

  RAISE NOTICE '✓ User has % permissions set with has_access=true', permission_count;

  -- Summary
  RAISE NOTICE '';
  RAISE NOTICE '=== SUMMARY ===';
  RAISE NOTICE 'User ID: %', target_user_id;
  RAISE NOTICE 'Organization ID: %', target_org_id;
  RAISE NOTICE 'Organization Owner: %', org_owner_id;
  RAISE NOTICE 'Is Owner Member: %', (member_count > 0);
  RAISE NOTICE 'Permission Count: %', permission_count;

  -- List all organizations the user is a member of
  RAISE NOTICE '';
  RAISE NOTICE '=== All organizations user is a member of ===';
  FOR rec IN
    SELECT om.organization_id, om.role, om.is_active, o.name, o.slug
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    WHERE om.user_id = target_user_id
  LOOP
    RAISE NOTICE '  - % (slug: %), role: %, active: %', 
      rec.name, rec.slug, rec.role, rec.is_active;
  END LOOP;

END $$;
