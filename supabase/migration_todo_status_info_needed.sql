-- Migration: Add "info_needed" status to todo_tasks
-- Run this in your Supabase SQL Editor

ALTER TABLE public.todo_tasks DROP CONSTRAINT IF EXISTS todo_tasks_status_check;
ALTER TABLE public.todo_tasks ADD CONSTRAINT todo_tasks_status_check
  CHECK (status = ANY (ARRAY['to_do'::text, 'in_progress'::text, 'blocked'::text, 'done'::text, 'info_needed'::text]));
