-- Simple Migration: Add client_type column ONLY
-- This is safe to run - it only adds a new column

-- Add client_type column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT;

-- Add check constraint to ensure only valid values
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE clients ADD CONSTRAINT clients_client_type_check 
  CHECK (client_type IS NULL OR client_type IN ('presales', 'customer'));

-- That's it! The status enum already exists, so we don't need to modify it.
-- The app will work with the existing status values.



