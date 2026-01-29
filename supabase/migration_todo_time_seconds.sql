-- Store duration in seconds so short timer stops (e.g. 17s) are not rounded to 0 minutes.
ALTER TABLE public.todo_task_time_entries
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

UPDATE public.todo_task_time_entries
  SET duration_seconds = duration_minutes * 60
  WHERE duration_seconds IS NULL;

-- Default for new rows (app will set explicitly)
ALTER TABLE public.todo_task_time_entries
  ALTER COLUMN duration_seconds SET DEFAULT 0;

-- Allow users to delete their own time entries
CREATE POLICY "todo_task_time_entries_delete_own"
  ON public.todo_task_time_entries
  FOR DELETE
  USING (user_id = auth.uid());
