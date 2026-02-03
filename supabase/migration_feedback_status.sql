-- Migration: Add status column to feedback (pending, working_on, done)
-- Run this in your Supabase SQL Editor

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS status text;

UPDATE public.feedback SET status = CASE WHEN completed THEN 'done' ELSE 'pending' END WHERE status IS NULL;

ALTER TABLE public.feedback ALTER COLUMN status SET DEFAULT 'pending';

-- Add constraint if not exists (drop first to allow re-run)
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_status_check CHECK (status IN ('pending', 'working_on', 'done'));
