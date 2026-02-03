-- Migration: Fix notifications RLS to allow task_mention and task_assigned
-- When user A mentions/assigns user B, the notification owner is B (not A).
-- The current policy only allows inserting when owner_id = auth.uid(), which blocks these cases.
-- This migration allows org members to insert notifications for other org members (same organization).

-- Ensure organization_id column exists (may have been added by assign_owner script)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;

-- Allow: (1) inserting for yourself, OR (2) inserting for another user when you're in the same org
-- In WITH CHECK for INSERT, column names refer to the new row being inserted
CREATE POLICY "Users can insert their own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      owner_id = auth.uid()
      OR (
        organization_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = notifications.organization_id
            AND om.user_id = auth.uid()
            AND om.is_active = true
        )
      )
    )
  );
