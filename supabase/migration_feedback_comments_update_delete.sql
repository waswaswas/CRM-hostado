-- Migration: Add UPDATE and DELETE policies for feedback_comments
-- Users can edit/delete their own comments; feedback admins can edit/delete any comment
-- Run this in your Supabase SQL Editor

-- Users can update their own comments; admins can update any
CREATE POLICY "feedback_comments_update"
  ON public.feedback_comments FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.feedback_admins fa WHERE fa.user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.feedback_admins fa WHERE fa.user_id = auth.uid())
  );

-- Users can delete their own comments; admins can delete any
CREATE POLICY "feedback_comments_delete"
  ON public.feedback_comments FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.feedback_admins fa WHERE fa.user_id = auth.uid())
  );
