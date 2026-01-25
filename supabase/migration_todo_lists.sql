-- Migration: To-Do Lists (online visibility)
-- This script adds org-scoped lists with member-based visibility.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Lists
CREATE TABLE IF NOT EXISTS public.todo_lists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#2563eb',
  invitation_code text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- List members (shared access)
CREATE TABLE IF NOT EXISTS public.todo_list_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id uuid NOT NULL REFERENCES public.todo_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role = ANY (ARRAY['owner'::text, 'member'::text])),
  joined_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (list_id, user_id)
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.todo_tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id uuid NOT NULL REFERENCES public.todo_lists(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'to_do' CHECK (status = ANY (ARRAY['to_do'::text, 'in_progress'::text, 'blocked'::text, 'done'::text])),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
  due_date date,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Subtasks
CREATE TABLE IF NOT EXISTS public.todo_task_subtasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.todo_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Comments
CREATE TABLE IF NOT EXISTS public.todo_task_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.todo_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Attachments (metadata only; file stored in storage)
CREATE TABLE IF NOT EXISTS public.todo_task_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.todo_tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Activity log
CREATE TABLE IF NOT EXISTS public.todo_task_activity (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.todo_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS todo_lists_org_idx ON public.todo_lists(organization_id);
CREATE INDEX IF NOT EXISTS todo_list_members_list_idx ON public.todo_list_members(list_id);
CREATE INDEX IF NOT EXISTS todo_list_members_user_idx ON public.todo_list_members(user_id);
CREATE INDEX IF NOT EXISTS todo_tasks_list_idx ON public.todo_tasks(list_id);
CREATE INDEX IF NOT EXISTS todo_tasks_assignee_idx ON public.todo_tasks(assignee_id);

-- RLS
ALTER TABLE public.todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_task_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_task_activity ENABLE ROW LEVEL SECURITY;

-- Helpers: owner/admin has org-wide visibility; viewers need list membership.
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
    OR EXISTS (
      SELECT 1 FROM public.todo_list_members tlm
      WHERE tlm.list_id = todo_lists.id
        AND tlm.user_id = auth.uid()
    )
  );

CREATE POLICY "todo_lists_insert_member_with_permission"
  ON public.todo_lists
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = todo_lists.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
  );

CREATE POLICY "todo_lists_update_owner_or_creator"
  ON public.todo_lists
  FOR UPDATE
  USING (
    todo_lists.created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = todo_lists.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role = 'owner'
    )
  );

CREATE POLICY "todo_lists_delete_owner_or_creator"
  ON public.todo_lists
  FOR DELETE
  USING (
    todo_lists.created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = todo_lists.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role = 'owner'
    )
  );

-- List members: visible to list members or org owner/admin.
CREATE POLICY "todo_list_members_select"
  ON public.todo_list_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = (SELECT organization_id FROM public.todo_lists tl WHERE tl.id = todo_list_members.list_id)
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.todo_list_members tlm
      WHERE tlm.list_id = todo_list_members.list_id
        AND tlm.user_id = auth.uid()
    )
  );

CREATE POLICY "todo_list_members_insert_owner_or_list_owner"
  ON public.todo_list_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todo_lists tl
      WHERE tl.id = todo_list_members.list_id
        AND (
          tl.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = tl.organization_id
              AND om.user_id = auth.uid()
              AND om.is_active = true
              AND om.role = 'owner'
          )
        )
    )
  );

CREATE POLICY "todo_list_members_delete_owner_or_list_owner"
  ON public.todo_list_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_lists tl
      WHERE tl.id = todo_list_members.list_id
        AND (
          tl.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = tl.organization_id
              AND om.user_id = auth.uid()
              AND om.is_active = true
              AND om.role = 'owner'
          )
        )
    )
  );

-- Tasks: accessible if user can access the list
CREATE POLICY "todo_tasks_select"
  ON public.todo_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_lists tl
      WHERE tl.id = todo_tasks.list_id
        AND (
          EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = tl.organization_id
              AND om.user_id = auth.uid()
              AND om.is_active = true
              AND om.role IN ('owner', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM public.todo_list_members tlm
            WHERE tlm.list_id = tl.id
              AND tlm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "todo_tasks_insert"
  ON public.todo_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todo_lists tl
      WHERE tl.id = todo_tasks.list_id
        AND (
          EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = tl.organization_id
              AND om.user_id = auth.uid()
              AND om.is_active = true
              AND om.role IN ('owner', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM public.todo_list_members tlm
            WHERE tlm.list_id = tl.id
              AND tlm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "todo_tasks_update"
  ON public.todo_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_lists tl
      WHERE tl.id = todo_tasks.list_id
        AND (
          EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = tl.organization_id
              AND om.user_id = auth.uid()
              AND om.is_active = true
              AND om.role IN ('owner', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM public.todo_list_members tlm
            WHERE tlm.list_id = tl.id
              AND tlm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "todo_tasks_delete"
  ON public.todo_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_lists tl
      WHERE tl.id = todo_tasks.list_id
        AND (
          EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = tl.organization_id
              AND om.user_id = auth.uid()
              AND om.is_active = true
              AND om.role IN ('owner', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM public.todo_list_members tlm
            WHERE tlm.list_id = tl.id
              AND tlm.user_id = auth.uid()
          )
        )
    )
  );

-- Subtables inherit list access via tasks
CREATE POLICY "todo_task_subtables_select"
  ON public.todo_task_subtasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_subtasks.task_id
    )
  );

CREATE POLICY "todo_task_subtables_insert"
  ON public.todo_task_subtasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_subtasks.task_id
    )
  );

CREATE POLICY "todo_task_subtables_update"
  ON public.todo_task_subtasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_subtasks.task_id
    )
  );

CREATE POLICY "todo_task_subtables_delete"
  ON public.todo_task_subtasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_subtasks.task_id
    )
  );

CREATE POLICY "todo_task_comments_select"
  ON public.todo_task_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_comments.task_id
    )
  );

CREATE POLICY "todo_task_comments_insert"
  ON public.todo_task_comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_comments.task_id
    )
  );

CREATE POLICY "todo_task_comments_update"
  ON public.todo_task_comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_comments.task_id
    )
  );

CREATE POLICY "todo_task_comments_delete"
  ON public.todo_task_comments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_comments.task_id
    )
  );

CREATE POLICY "todo_task_attachments_select"
  ON public.todo_task_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_attachments.task_id
    )
  );

CREATE POLICY "todo_task_attachments_insert"
  ON public.todo_task_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_attachments.task_id
    )
  );

CREATE POLICY "todo_task_attachments_update"
  ON public.todo_task_attachments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_attachments.task_id
    )
  );

CREATE POLICY "todo_task_attachments_delete"
  ON public.todo_task_attachments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_attachments.task_id
    )
  );

CREATE POLICY "todo_task_activity_select"
  ON public.todo_task_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_activity.task_id
    )
  );

CREATE POLICY "todo_task_activity_insert"
  ON public.todo_task_activity
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todo_tasks tt
      WHERE tt.id = todo_task_activity.task_id
    )
  );

-- Join list by invitation code (secure server-side helper)
CREATE OR REPLACE FUNCTION public.join_todo_list_by_code(code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id, organization_id
    INTO v_list_id, v_org_id
  FROM public.todo_lists
  WHERE invitation_code = code;

  IF v_list_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation code';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  INSERT INTO public.todo_list_members (list_id, user_id, role)
  VALUES (v_list_id, auth.uid(), 'member')
  ON CONFLICT (list_id, user_id) DO NOTHING;

  RETURN v_list_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_todo_list_by_code(text) TO authenticated;
