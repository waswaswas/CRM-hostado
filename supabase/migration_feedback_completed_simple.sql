-- Migration: Add completed column to feedback table (Simple Version)
-- Run this in your Supabase SQL Editor

-- Add completed column
ALTER TABLE public.feedback ADD COLUMN completed boolean DEFAULT false;

-- Set default for any existing rows
UPDATE public.feedback SET completed = false WHERE completed IS NULL;

-- Make it NOT NULL
ALTER TABLE public.feedback ALTER COLUMN completed SET NOT NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_feedback_completed ON public.feedback(completed);
