-- Verification script: Check if offers and payments tables exist
-- Run this to verify the migration was successful

-- Check if offers table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'offers'
    ) THEN '✓ Offers table exists'
    ELSE '✗ Offers table does NOT exist'
  END AS offers_table_status;

-- Check if payments table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'payments'
    ) THEN '✓ Payments table exists'
    ELSE '✗ Payments table does NOT exist'
  END AS payments_table_status;

-- Check RLS policies on offers
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'offers';

-- Check RLS policies on payments
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'payments';

-- Check indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('offers', 'payments')
ORDER BY tablename, indexname;

-- Count offers (if any exist)
SELECT COUNT(*) as total_offers FROM offers;

-- Count payments (if any exist)
SELECT COUNT(*) as total_payments FROM payments;






















