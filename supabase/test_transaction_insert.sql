-- Test script to verify RLS policies work correctly
-- Run this to test if you can insert a transaction manually

-- First, check your current user ID
SELECT auth.uid() as current_user_id;

-- Try to insert a test transaction (replace the account_id with a real one from your accounts table)
-- This will help identify if the issue is with RLS or something else
INSERT INTO transactions (
  owner_id,
  account_id,
  type,
  number,
  date,
  amount,
  currency,
  payment_method
) VALUES (
  auth.uid(),  -- This should match your user ID from above
  (SELECT id FROM accounts WHERE owner_id = auth.uid() LIMIT 1),  -- Get first account
  'expense',
  'TEST-001',
  CURRENT_DATE,
  100.00,
  'EUR',
  'cash'
) RETURNING *;

-- If this works, the RLS policies are correct
-- If this fails, check the error message










