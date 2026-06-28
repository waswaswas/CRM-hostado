-- Offer email sequence enrollments
CREATE TABLE IF NOT EXISTS offer_email_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  current_step INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped')),
  next_send_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  UNIQUE(offer_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_email_enrollments_next_send
  ON offer_email_enrollments(status, next_send_at)
  WHERE status = 'active';

ALTER TABLE offer_email_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY offer_email_enrollments_org_read ON offer_email_enrollments
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
