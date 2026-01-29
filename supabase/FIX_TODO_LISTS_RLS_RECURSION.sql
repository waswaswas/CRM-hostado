-- Fix: infinite recursion between todo_lists and todo_list_members RLS policies.
-- Policies on todo_list_members read todo_lists; todo_lists SELECT policy reads todo_list_members.
-- Use SECURITY DEFINER helpers so policies never cross-read through RLS.

-- Helper: return organization_id for a list (bypasses RLS when read from todo_list_members policies)
CREATE OR REPLACE FUNCTION public.get_todo_list_organization_id(p_list_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.todo_lists WHERE id = p_list_id;
$$;

-- Helper: return created_by for a list (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_todo_list_created_by(p_list_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT created_by FROM public.todo_lists WHERE id = p_list_id;
$$;

-- Helper: check if user is member of list (bypasses RLS when read from todo_lists SELECT policy)
-- This breaks the cycle: todo_lists SELECT no longer queries todo_list_members directly.
CREATE OR REPLACE FUNCTION public.user_is_todo_list_member(p_list_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.todo_list_members
    WHERE list_id = p_list_id AND user_id = p_user_id
  );
$$;

-- Drop todo_lists SELECT policy and recreate it without reading todo_list_members (use helper instead)
DROP POLICY IF EXISTS "todo_lists_select_owner_admin_or_member" ON public.todo_lists;
CREATE POLICY "todo_lists_select_owner_admin_or_member"
  ON public.todo_lists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = todo_lists.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member(todo_lists.id, auth.uid())
  );

-- Drop policies that reference todo_lists (they cause recursion when re-evaluated)
DROP POLICY IF EXISTS "todo_list_members_select" ON public.todo_list_members;
DROP POLICY IF EXISTS "todo_list_members_insert_owner_or_list_owner" ON public.todo_list_members;
DROP POLICY IF EXISTS "todo_list_members_delete_owner_or_list_owner" ON public.todo_list_members;

-- Recreate: use helpers only (no direct read of todo_list_members to avoid self-recursion)
CREATE POLICY "todo_list_members_select"
  ON public.todo_list_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_list_members.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member(todo_list_members.list_id, auth.uid())
  );

CREATE POLICY "todo_list_members_insert_owner_or_list_owner"
  ON public.todo_list_members
  FOR INSERT
  WITH CHECK (
    public.get_todo_list_created_by(todo_list_members.list_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_list_members.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role = 'owner'
    )
  );

CREATE POLICY "todo_list_members_delete_owner_or_list_owner"
  ON public.todo_list_members
  FOR DELETE
  USING (
    public.get_todo_list_created_by(todo_list_members.list_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_list_members.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role = 'owner'
    )
  );

-- todo_tasks: use helpers only so we never read todo_lists/todo_list_members through RLS (avoids recursion)
DROP POLICY IF EXISTS "todo_tasks_select" ON public.todo_tasks;
DROP POLICY IF EXISTS "todo_tasks_insert" ON public.todo_tasks;
DROP POLICY IF EXISTS "todo_tasks_update" ON public.todo_tasks;
DROP POLICY IF EXISTS "todo_tasks_delete" ON public.todo_tasks;

CREATE POLICY "todo_tasks_select"
  ON public.todo_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_tasks.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member(todo_tasks.list_id, auth.uid())
  );

CREATE POLICY "todo_tasks_insert"
  ON public.todo_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_tasks.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member(todo_tasks.list_id, auth.uid())
  );

CREATE POLICY "todo_tasks_update"
  ON public.todo_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_tasks.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member(todo_tasks.list_id, auth.uid())
  );

CREATE POLICY "todo_tasks_delete"
  ON public.todo_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.get_todo_list_organization_id(todo_tasks.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member(todo_tasks.list_id, auth.uid())
  );
