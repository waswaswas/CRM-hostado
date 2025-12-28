-- Migration: Add accounting_customers table (separate from CRM clients)
-- This creates a separate customer management system for accounting

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: accounting_customers
CREATE TABLE IF NOT EXISTS accounting_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_number TEXT,
  website TEXT,
  notes TEXT,
  linked_client_id UUID -- Link to CRM client
);

-- Add foreign key constraints only if they don't exist
DO $$ 
BEGIN
  -- Add owner_id foreign key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'accounting_customers_owner_id_fkey'
  ) THEN
    ALTER TABLE accounting_customers
      ADD CONSTRAINT accounting_customers_owner_id_fkey 
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add linked_client_id foreign key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'accounting_customers_linked_client_id_fkey'
  ) THEN
    ALTER TABLE accounting_customers
      ADD CONSTRAINT accounting_customers_linked_client_id_fkey 
      FOREIGN KEY (linked_client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better query performance (IF NOT EXISTS handles duplicates)
CREATE INDEX IF NOT EXISTS idx_accounting_customers_owner_id ON accounting_customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounting_customers_linked_client_id ON accounting_customers(linked_client_id);
CREATE INDEX IF NOT EXISTS idx_accounting_customers_email ON accounting_customers(email);
CREATE INDEX IF NOT EXISTS idx_accounting_customers_name ON accounting_customers(name);

-- Enable Row Level Security
ALTER TABLE accounting_customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounting_customers (DROP IF EXISTS to allow re-running)
DROP POLICY IF EXISTS "Users can view their own accounting customers" ON accounting_customers;
DROP POLICY IF EXISTS "Users can insert their own accounting customers" ON accounting_customers;
DROP POLICY IF EXISTS "Users can update their own accounting customers" ON accounting_customers;
DROP POLICY IF EXISTS "Users can delete their own accounting customers" ON accounting_customers;

CREATE POLICY "Users can view their own accounting customers"
  ON accounting_customers FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own accounting customers"
  ON accounting_customers FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own accounting customers"
  ON accounting_customers FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own accounting customers"
  ON accounting_customers FOR DELETE
  USING (auth.uid() = owner_id);

-- Update transactions table to reference accounting_customers instead of clients
-- Note: This is a breaking change, so we'll keep contact_id for now but add a new field
-- For new transactions, use accounting_customer_id
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS accounting_customer_id UUID;

-- Add foreign key constraint for accounting_customer_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transactions_accounting_customer_id_fkey'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_accounting_customer_id_fkey 
      FOREIGN KEY (accounting_customer_id) REFERENCES accounting_customers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_accounting_customer_id ON transactions(accounting_customer_id);

