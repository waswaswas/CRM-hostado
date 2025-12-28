-- Setup: Add feedback table for improvement notes
-- Run this in your Supabase SQL Editor to enable Feedback functionality

-- Table: feedback
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  owner_id uuid NOT NULL,
  note text NOT NULL,
  priority text,
  completed boolean NOT NULL DEFAULT false,
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_owner_id ON public.feedback(owner_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_completed ON public.feedback(completed);

-- Updated_at trigger (if the function exists)
DROP TRIGGER IF EXISTS update_feedback_updated_at ON public.feedback;
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON public.feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can delete their own feedback" ON public.feedback;

-- Feedback Policies
CREATE POLICY "Users can view their own feedback" ON public.feedback FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert their own feedback" ON public.feedback FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update their own feedback" ON public.feedback FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete their own feedback" ON public.feedback FOR DELETE USING (owner_id = auth.uid());











