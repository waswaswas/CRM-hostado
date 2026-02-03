-- Migration: Add "info_needed" status to feedback table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('pending', 'working_on', 'done', 'info_needed'));
