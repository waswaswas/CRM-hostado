-- Migration: Add accounting tables (accounts and transactions)
-- This creates the database schema for accounting/income-expense management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_number TEXT,
  bank_name TEXT,
  bank_phone TEXT,
  type TEXT NOT NULL DEFAULT 'bank'::text CHECK (type = ANY (ARRAY['bank'::text, 'cash'::text, 'credit_card'::text, 'other'::text])),
  currency TEXT NOT NULL DEFAULT 'BGN'::text,
  opening_balance NUMERIC(10, 2) NOT NULL DEFAULT 0::numeric,
  current_balance NUMERIC(10, 2) NOT NULL DEFAULT 0::numeric,
  is_locked BOOLEAN DEFAULT false,
  notes TEXT
);

-- Table: transaction_categories
CREATE TABLE IF NOT EXISTS transaction_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  color TEXT,
  parent_id UUID REFERENCES transaction_categories(id) ON DELETE SET NULL,
  CONSTRAINT transaction_categories_owner_name_unique UNIQUE (owner_id, name, type) -- Ensure unique category names per user and type
);

-- Table: transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text])),
  number TEXT NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0::numeric),
  currency TEXT NOT NULL DEFAULT 'BGN'::text,
  category TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash'::text,
  description TEXT,
  reference TEXT,
  contact_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  tax_id UUID, -- For future tax integration
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  transfer_to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- For transfer transactions
  transfer_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Link to paired transfer transaction
  CONSTRAINT transactions_owner_number_unique UNIQUE (owner_id, number) -- Ensure unique transaction numbers per user
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_transactions_owner_id ON transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(number);
CREATE INDEX IF NOT EXISTS idx_transactions_contact_id ON transactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_transaction_categories_owner_id ON transaction_categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_transaction_categories_type ON transaction_categories(type);

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
CREATE POLICY "Users can view their own accounts"
  ON accounts FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own accounts"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own accounts"
  ON accounts FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own accounts"
  ON accounts FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for transaction_categories
CREATE POLICY "Users can view their own categories"
  ON transaction_categories FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own categories"
  ON transaction_categories FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own categories"
  ON transaction_categories FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own categories"
  ON transaction_categories FOR DELETE
  USING (auth.uid() = owner_id);

-- Function to update account balance when transaction is created/updated/deleted
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  balance_change NUMERIC(10, 2);
BEGIN
  -- Calculate balance change based on transaction type
  IF TG_OP = 'DELETE' THEN
    -- Reverting a transaction
    IF OLD.type = 'income' THEN
      balance_change := -OLD.amount;
    ELSIF OLD.type = 'expense' THEN
      balance_change := OLD.amount;
    ELSIF OLD.type = 'transfer' THEN
      -- For transfers, we need to handle both accounts
      -- This is handled in the application layer for simplicity
      balance_change := OLD.amount;
    END IF;
    
    UPDATE accounts
    SET current_balance = current_balance + balance_change,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = OLD.account_id;
    
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    -- Adding a new transaction
    IF NEW.type = 'income' THEN
      balance_change := NEW.amount;
    ELSIF NEW.type = 'expense' THEN
      balance_change := -NEW.amount;
    ELSIF NEW.type = 'transfer' THEN
      -- For transfers, debit the source account
      balance_change := -NEW.amount;
    END IF;
    
    UPDATE accounts
    SET current_balance = current_balance + balance_change,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = NEW.account_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Updating a transaction (handle account change and amount change)
    IF OLD.account_id != NEW.account_id OR OLD.amount != NEW.amount OR OLD.type != NEW.type THEN
      -- Revert old transaction
      IF OLD.type = 'income' THEN
        balance_change := -OLD.amount;
      ELSIF OLD.type = 'expense' THEN
        balance_change := OLD.amount;
      ELSIF OLD.type = 'transfer' THEN
        balance_change := OLD.amount;
      END IF;
      
      UPDATE accounts
      SET current_balance = current_balance + balance_change,
          updated_at = NOW()
      WHERE id = OLD.account_id;
      
      -- Apply new transaction
      IF NEW.type = 'income' THEN
        balance_change := NEW.amount;
      ELSIF NEW.type = 'expense' THEN
        balance_change := -NEW.amount;
      ELSIF NEW.type = 'transfer' THEN
        balance_change := -NEW.amount;
      END IF;
      
      UPDATE accounts
      SET current_balance = current_balance + balance_change,
          updated_at = NOW()
      WHERE id = NEW.account_id;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update account balance
DROP TRIGGER IF EXISTS trigger_update_account_balance ON transactions;
CREATE TRIGGER trigger_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- Insert default categories
-- Note: These will be created per user when they first access accounting
-- For now, we'll create a function to initialize default categories

CREATE OR REPLACE FUNCTION initialize_default_categories(user_id UUID)
RETURNS void AS $$
BEGIN
  -- Income categories
  INSERT INTO transaction_categories (owner_id, name, type, color) VALUES
    (user_id, 'Sales', 'income', '#10b981'),
    (user_id, 'Transfer', 'income', '#3b82f6')
  ON CONFLICT (owner_id, name, type) DO NOTHING;
  
  -- Expense categories
  INSERT INTO transaction_categories (owner_id, name, type, color) VALUES
    (user_id, 'Expenses', 'expense', '#ef4444'),
    (user_id, 'Transfer', 'expense', '#3b82f6'),
    (user_id, 'Events', 'expense', '#8b5cf6'),
    (user_id, 'Other', 'expense', '#6b7280'),
    (user_id, 'Salaries', 'expense', '#f59e0b'),
    (user_id, 'Ads', 'expense', '#ec4899'),
    (user_id, 'Dani payouts', 'expense', '#14b8a6'),
    (user_id, 'Third party', 'expense', '#6366f1'),
    (user_id, 'VAT', 'expense', '#f97316')
  ON CONFLICT (owner_id, name, type) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

