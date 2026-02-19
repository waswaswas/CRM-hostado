-- Add 'test_needed' to feedback status allowed values
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'working_on'::text, 'done'::text, 'info_needed'::text, 'test_needed'::text]));
