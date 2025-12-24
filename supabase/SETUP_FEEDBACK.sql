-- Setup: Add feedback table for improvement notes
-- Run this in your Supabase SQL Editor to enable Feedback functionality

-- Table: feedback
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  note TEXT NOT NULL,
  priority TEXT -- 'low', 'medium', 'high', or null
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_owner_id ON feedback(owner_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can delete their own feedback" ON feedback;

-- Feedback Policies
CREATE POLICY "Users can view their own feedback" ON feedback FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert their own feedback" ON feedback FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update their own feedback" ON feedback FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete their own feedback" ON feedback FOR DELETE USING (owner_id = auth.uid());




