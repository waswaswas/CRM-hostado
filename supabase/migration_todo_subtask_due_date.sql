-- Add optional due_date to subtasks (rename, delete already supported via existing RLS)
ALTER TABLE public.todo_task_subtasks
  ADD COLUMN IF NOT EXISTS due_date date;
