-- Migration: Add task_assigned and task_mention to notification types
-- Run this in your Supabase SQL Editor

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['email'::text, 'reminder'::text, 'tag_removed'::text, 'other'::text, 'task_assigned'::text, 'task_mention'::text]));
