-- Migration: Fix notifications RLS to allow task_mention and task_assigned
-- When user A mentions/assigns user B, the notification owner is B (not A).
-- The current policy only allows inserting when owner_id = auth.uid(), which blocks these cases.
-- This migration allows org members to insert notifications for other org members (same organization).

-- Ensure organization_id column exists (may have been added by assign_owner script)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;

-- Allow: (1) inserting for yourself, OR (2) inserting for another user when both share an org
-- In WITH CHECK for INSERT, column names refer to the new row being inserted
CREATE POLICY "Users can insert their own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      owner_id = auth.uid()
      OR (
        -- Inserter and owner must share at least one org (for task_mention, task_assigned)
        EXISTS (
          SELECT 1 FROM public.organization_members om1
          JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
          WHERE om1.user_id = auth.uid()
            AND om2.user_id = notifications.owner_id
            AND om1.is_active = true
            AND om2.is_active = true
        )
      )
    )
  );
