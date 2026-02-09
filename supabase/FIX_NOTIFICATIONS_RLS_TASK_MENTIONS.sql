-- Fix: Allow task_mention and task_assigned notifications (user A notifies user B)
-- Run this in Supabase SQL Editor to fix "new row violates row-level security policy"
--
-- Anyone in a todo list can tag other members of the same list. Uses SECURITY DEFINER
-- to bypass RLS when checking todo_list_members.
-- Requires: FIX_TODO_LISTS_RLS_RECURSION.sql (user_is_todo_list_member) must be applied.

-- Ensure organization_id column exists
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Helper: is current user an active member of this org? (SECURITY DEFINER so RLS on organization_members doesn't block)
CREATE OR REPLACE FUNCTION public.user_is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  );
$$;
GRANT EXECUTE ON FUNCTION public.user_is_org_member(uuid) TO authenticated;

-- RPC: insert task_mention/task_assigned for another user (bypasses RLS). Call from app when owner_id != current user.
CREATE OR REPLACE FUNCTION public.insert_task_notification_for_user(
  p_owner_id uuid,
  p_organization_id uuid,
  p_type text,
  p_title text,
  p_message text DEFAULT NULL,
  p_related_id uuid DEFAULT NULL,
  p_related_type text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notifications%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('task_mention', 'task_assigned') THEN
    RAISE EXCEPTION 'Invalid type for insert_task_notification_for_user';
  END IF;
  IF p_organization_id IS NULL OR NOT public.user_is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'Not allowed: must be member of the notification organization';
  END IF;

  INSERT INTO public.notifications (owner_id, organization_id, type, title, message, related_id, related_type, metadata, is_read)
  VALUES (p_owner_id, p_organization_id, p_type, p_title, p_message, p_related_id, p_related_type, COALESCE(p_metadata, '{}'::jsonb), false)
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;
GRANT EXECUTE ON FUNCTION public.insert_task_notification_for_user(uuid, uuid, text, text, text, uuid, text, jsonb) TO authenticated;

-- Helper: can current user insert a notification for target_owner_id?
-- For task_mention/task_assigned: inserter must have list access; target can be list member OR org member.
CREATE OR REPLACE FUNCTION public.user_can_insert_notification_for(
  p_owner_id uuid,
  p_related_id uuid,
  p_related_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_list_id uuid;
  v_org_id uuid;
BEGIN
  IF p_related_type IS NULL OR (p_related_type != 'todo_task' AND p_related_type != 'task_assigned') THEN
    RETURN false;
  END IF;
  IF p_related_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT list_id INTO v_list_id FROM public.todo_tasks WHERE id = p_related_id;
  IF v_list_id IS NULL THEN
    RETURN false;
  END IF;

  v_org_id := public.get_todo_list_organization_id(v_list_id);
  IF v_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Inserter: org owner/admin OR todo list member
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = v_org_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR public.user_is_todo_list_member(v_list_id, auth.uid())
  ) THEN
    RETURN false;
  END IF;

  -- Target: list member OR any member of the same org (so org members can be mentioned)
  RETURN (
    public.user_is_todo_list_member(v_list_id, p_owner_id)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = v_org_id
        AND om.user_id = p_owner_id
        AND om.is_active = true
    )
  );
END;
$$;

-- Ensure authenticated role can execute the function (required for RLS policy)
GRANT EXECUTE ON FUNCTION public.user_can_insert_notification_for(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_insert_notification_for(uuid, uuid, text) TO service_role;

-- Drop all insert policies so only our unified policy applies (prevents conflict with org-only policy)
DROP POLICY IF EXISTS "Users can insert notifications in their organizations" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_can_insert_own_notifications" ON public.notifications;

-- Create policy: (1) self, (2) task_mention/task_assigned when user is in same org, (3) list-based via function
CREATE POLICY "Users can insert their own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      owner_id = auth.uid()
      OR (
        -- Same-org path: any org member can create task_mention/task_assigned (SECURITY DEFINER so RLS does not block)
        type IN ('task_mention', 'task_assigned')
        AND organization_id IS NOT NULL
        AND public.user_is_org_member(organization_id)
      )
      OR public.user_can_insert_notification_for(owner_id, related_id, related_type)
    )
  );
