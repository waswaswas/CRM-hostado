-- Allow one designated user (waswaswas28@gmail.com) to see all feedback application-wide.
-- Other users continue to see only their own feedback (existing policy).

-- Table of user_ids who can see all feedback from all organizations
CREATE TABLE IF NOT EXISTS public.feedback_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Populate: add user by email (run once; safe to re-run)
INSERT INTO public.feedback_admins (user_id)
SELECT id FROM auth.users WHERE email = 'waswaswas28@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.feedback_admins ENABLE ROW LEVEL SECURITY;

-- Drop then create so script is safe to re-run
DROP POLICY IF EXISTS "Feedback admins can read feedback_admins" ON public.feedback_admins;
CREATE POLICY "Feedback admins can read feedback_admins"
  ON public.feedback_admins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Feedback table: drop previous policies if they exist (for re-runs)
DROP POLICY IF EXISTS "Feedback admins can view all feedback in their orgs" ON public.feedback;
DROP POLICY IF EXISTS "Feedback admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Feedback admins can update any feedback" ON public.feedback;
DROP POLICY IF EXISTS "Feedback admins can delete any feedback" ON public.feedback;

-- SELECT: admins can see all feedback from all organizations
CREATE POLICY "Feedback admins can view all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.feedback_admins));

-- UPDATE/DELETE: admins can update and delete any feedback (same as owner)
CREATE POLICY "Feedback admins can update any feedback"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.feedback_admins))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.feedback_admins));

CREATE POLICY "Feedback admins can delete any feedback"
  ON public.feedback FOR DELETE
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.feedback_admins));
