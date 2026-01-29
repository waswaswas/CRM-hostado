-- Time tracking: entries (timer, manual, correction) and running timer sessions.
-- Scope: one running timer per user per todo_list (enforced in app).
-- Requires: FIX_TODO_LISTS_RLS_RECURSION.sql (get_todo_list_organization_id, user_is_todo_list_member).

CREATE TABLE IF NOT EXISTS public.todo_task_time_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.todo_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('timer', 'manual', 'correction')),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  duration_minutes integer NOT NULL CHECK (duration_minutes >= 0),
  note text,
  corrected_entry_id uuid REFERENCES public.todo_task_time_entries(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS todo_task_time_entries_task_idx ON public.todo_task_time_entries(task_id);
CREATE INDEX IF NOT EXISTS todo_task_time_entries_user_idx ON public.todo_task_time_entries(user_id);
CREATE INDEX IF NOT EXISTS todo_task_time_entries_corrected_idx ON public.todo_task_time_entries(corrected_entry_id);

CREATE TABLE IF NOT EXISTS public.todo_task_timer_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.todo_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL,
  stopped_at timestamp with time zone,
  is_running boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS todo_task_timer_sessions_user_running_idx ON public.todo_task_timer_sessions(user_id) WHERE is_running = true;

ALTER TABLE public.todo_task_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_task_timer_sessions ENABLE ROW LEVEL SECURITY;

-- Access same as tasks (via task -> list)
CREATE POLICY "todo_task_time_entries_select"
  ON public.todo_task_time_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id((SELECT list_id FROM public.todo_tasks WHERE id = todo_task_time_entries.task_id))
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member((SELECT list_id FROM public.todo_tasks WHERE id = todo_task_time_entries.task_id), auth.uid())
  );

CREATE POLICY "todo_task_time_entries_insert"
  ON public.todo_task_time_entries
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = public.get_todo_list_organization_id((SELECT list_id FROM public.todo_tasks WHERE id = todo_task_time_entries.task_id))
          AND om.user_id = auth.uid()
          AND om.is_active = true
          AND om.role IN ('owner', 'admin')
      )
      OR public.user_is_todo_list_member((SELECT list_id FROM public.todo_tasks WHERE id = todo_task_time_entries.task_id), auth.uid())
    )
  );

CREATE POLICY "todo_task_timer_sessions_select"
  ON public.todo_task_timer_sessions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id((SELECT list_id FROM public.todo_tasks WHERE id = todo_task_timer_sessions.task_id))
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member((SELECT list_id FROM public.todo_tasks WHERE id = todo_task_timer_sessions.task_id), auth.uid())
  );

CREATE POLICY "todo_task_timer_sessions_insert"
  ON public.todo_task_timer_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "todo_task_timer_sessions_update"
  ON public.todo_task_timer_sessions
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "todo_task_timer_sessions_delete"
  ON public.todo_task_timer_sessions
  FOR DELETE
  USING (user_id = auth.uid());
