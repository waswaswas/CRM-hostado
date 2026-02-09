-- Migration: Fix notifications RLS to allow task_mention and task_assigned
-- When user A mentions/assigns user B, the notification owner is B (not A).
-- The current policy only allows inserting when owner_id = auth.uid(), which blocks these cases.
-- This migration allows any todo list member to tag other members of the same list.
--
-- Requires: FIX_TODO_LISTS_RLS_RECURSION.sql (user_is_todo_list_member) must be applied.

-- Ensure organization_id column exists (may have been added by assign_owner script)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

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

  -- Target: list member OR any member of the same org
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

GRANT EXECUTE ON FUNCTION public.user_can_insert_notification_for(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_insert_notification_for(uuid, uuid, text) TO service_role;

DROP POLICY IF EXISTS "Users can insert notifications in their organizations" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_can_insert_own_notifications" ON public.notifications;

-- Allow: (1) self, (2) task_mention/task_assigned when user in same org, (3) list-based via function
CREATE POLICY "Users can insert their own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      owner_id = auth.uid()
      OR (
        type IN ('task_mention', 'task_assigned')
        AND organization_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = notifications.organization_id
            AND om.user_id = auth.uid()
            AND om.is_active = true
        )
      )
      OR public.user_can_insert_notification_for(owner_id, related_id, related_type)
    )
  );
