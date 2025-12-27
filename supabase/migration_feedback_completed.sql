-- Migration: Add completed column to feedback table
-- Run this in your Supabase SQL Editor

-- Check if column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'feedback' 
    AND column_name = 'completed'
  ) THEN
    -- Add column with default value
    ALTER TABLE public.feedback ADD COLUMN completed boolean DEFAULT false;
    
    -- Update any existing NULL values (shouldn't be any, but just in case)
    UPDATE public.feedback SET completed = false WHERE completed IS NULL;
    
    -- Make it NOT NULL
    ALTER TABLE public.feedback ALTER COLUMN completed SET NOT NULL;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_completed ON public.feedback(completed);




