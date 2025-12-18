-- Migration: Add client_type column and update status enum
-- Run this in your Supabase SQL Editor

-- Step 1: Add client_type column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT CHECK (client_type IN ('presales', 'customer'));

-- Step 2: Update status enum to include new values
-- First, let's check if we need to add new enum values
-- Since PostgreSQL doesn't easily allow adding to existing enums, we'll use a workaround

-- Add new status values by creating a new type and migrating
DO $$ 
BEGIN
    -- Check if new enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status_new') THEN
        -- Create new enum with all values
        CREATE TYPE client_status_new AS ENUM (
            'new', 
            'contacted', 
            'in_progress', 
            'won', 
            'lost',
            'to_be_contacted',
            'waiting_for_response',
            'waiting_for_offer',
            'abandoned'
        );
        
        -- Migrate existing data
        ALTER TABLE clients 
        ALTER COLUMN status TYPE client_status_new 
        USING CASE 
            WHEN status::text = 'new' THEN 'new'::client_status_new
            WHEN status::text = 'contacted' THEN 'contacted'::client_status_new
            WHEN status::text = 'in_progress' THEN 'in_progress'::client_status_new
            WHEN status::text = 'won' THEN 'won'::client_status_new
            WHEN status::text = 'lost' THEN 'lost'::client_status_new
            ELSE 'new'::client_status_new
        END;
        
        -- Drop old type
        DROP TYPE client_status;
        
        -- Rename new type
        ALTER TYPE client_status_new RENAME TO client_status;
    END IF;
END $$;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('client_type', 'status');



