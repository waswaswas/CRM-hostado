-- Phase 1: Projects inside each To-Do List
-- Add todo_projects and optional project_id on todo_tasks. No removal of existing columns.
-- Requires: run FIX_TODO_LISTS_RLS_RECURSION.sql first (provides get_todo_list_organization_id, user_is_todo_list_member).

CREATE TABLE IF NOT EXISTS public.todo_projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id uuid NOT NULL REFERENCES public.todo_lists(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS todo_projects_list_idx ON public.todo_projects(list_id);

ALTER TABLE public.todo_tasks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.todo_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS todo_tasks_project_idx ON public.todo_tasks(project_id);

-- RLS: reuse list access (user can see project if they can see the list)
ALTER TABLE public.todo_projects ENABLE ROW LEVEL SECURITY;

-- Use existing helpers to avoid RLS recursion (no direct read of todo_lists)
CREATE POLICY "todo_projects_select_via_list"
  ON public.todo_projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_projects.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member(todo_projects.list_id, auth.uid())
  );

CREATE POLICY "todo_projects_insert_via_list"
  ON public.todo_projects
  FOR INSERT
  WITH CHECK (
    public.user_is_todo_list_member(todo_projects.list_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_projects.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "todo_projects_update_via_list"
  ON public.todo_projects
  FOR UPDATE
  USING (
    public.user_is_todo_list_member(todo_projects.list_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_projects.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "todo_projects_delete_via_list"
  ON public.todo_projects
  FOR DELETE
  USING (
    public.user_is_todo_list_member(todo_projects.list_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_projects.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
  );
