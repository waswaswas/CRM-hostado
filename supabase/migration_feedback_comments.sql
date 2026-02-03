-- Migration: Add feedback_comments table for threaded exchange
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback_id ON public.feedback_comments(feedback_id);

ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on feedback they can view (own feedback or admin)
CREATE POLICY "feedback_comments_select"
  ON public.feedback_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.feedback f
      WHERE f.id = feedback_comments.feedback_id
      AND (f.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.feedback_admins fa WHERE fa.user_id = auth.uid()))
    )
  );

-- Users can insert comments on feedback they can view (own or admin)
CREATE POLICY "feedback_comments_insert"
  ON public.feedback_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.feedback f
      WHERE f.id = feedback_id
      AND (f.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.feedback_admins fa WHERE fa.user_id = auth.uid()))
    )
  );
