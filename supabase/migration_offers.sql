-- Migration: Add offers and payments tables
-- This creates the database schema for offers management with payment integration

-- Table: offers
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BGN',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'paid', 'pending_payment')),
  valid_until DATE,
  notes TEXT,
  document_url TEXT,
  payment_enabled BOOLEAN NOT NULL DEFAULT true,
  payment_link TEXT,
  payment_token TEXT, -- Secure token for public payment access
  payment_provider TEXT CHECK (payment_provider IN ('stripe', 'epay', 'paypal', 'manual')),
  payment_status TEXT CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  payment_id TEXT, -- External payment transaction ID
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT
);

-- Table: payments (payment history)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  payment_provider TEXT NOT NULL CHECK (payment_provider IN ('stripe', 'epay', 'paypal', 'manual')),
  payment_id TEXT, -- External payment transaction ID
  payment_method TEXT,
  client_email TEXT,
  client_name TEXT,
  metadata JSONB, -- Store additional payment data
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for offers
CREATE POLICY "Users can view their own offers"
  ON offers FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own offers"
  ON offers FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own offers"
  ON offers FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own offers"
  ON offers FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for payments
CREATE POLICY "Users can view payments for their offers"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = payments.offer_id
      AND offers.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert payments for their offers"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = payments.offer_id
      AND offers.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update payments for their offers"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = payments.offer_id
      AND offers.owner_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_offers_owner_id ON offers(owner_id);
CREATE INDEX IF NOT EXISTS idx_offers_client_id ON offers(client_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_payment_status ON offers(payment_status);
CREATE INDEX IF NOT EXISTS idx_offers_payment_token ON offers(payment_token);
CREATE INDEX IF NOT EXISTS idx_payments_offer_id ON payments(offer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();






















