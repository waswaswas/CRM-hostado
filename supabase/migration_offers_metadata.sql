-- Minimal migration: add metadata JSONB to offers (no new tables).
-- Run this in Supabase SQL Editor when available. All new offer fields live in metadata.

ALTER TABLE offers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN offers.metadata IS 'OfferMetadata: is_public, is_published, published_at, unpublish_after_days, is_archived, line_items, recipient_snapshot';
