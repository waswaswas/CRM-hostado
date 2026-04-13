-- Per-user quick notes (top bar). Only the creator can see/edit/delete (RLS).
-- Safe to run multiple times (idempotent policy creation).

CREATE TABLE IF NOT EXISTS public.user_quick_notes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  user_id uuid NOT NULL,
  content text NOT NULL,
  CONSTRAINT user_quick_notes_pkey PRIMARY KEY (id),
  CONSTRAINT user_quick_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_quick_notes_content_nonempty CHECK (char_length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS user_quick_notes_user_id_created_at_idx
  ON public.user_quick_notes (user_id, created_at DESC);

ALTER TABLE public.user_quick_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_quick_notes' AND policyname = 'user_quick_notes_select_own'
  ) THEN
    CREATE POLICY user_quick_notes_select_own ON public.user_quick_notes
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_quick_notes' AND policyname = 'user_quick_notes_insert_own'
  ) THEN
    CREATE POLICY user_quick_notes_insert_own ON public.user_quick_notes
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_quick_notes' AND policyname = 'user_quick_notes_update_own'
  ) THEN
    CREATE POLICY user_quick_notes_update_own ON public.user_quick_notes
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_quick_notes' AND policyname = 'user_quick_notes_delete_own'
  ) THEN
    CREATE POLICY user_quick_notes_delete_own ON public.user_quick_notes
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END
$$;
