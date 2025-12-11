-- Migration: Update status enum to new values
-- This replaces the old status values with the new Presales/Customer system
-- Run this AFTER adding the client_type column

-- Note: This is a complex migration. If you have existing data, you may need to map old statuses to new ones.
-- For a fresh database, you can just update the enum definition.

-- Step 1: Create new enum types
DO $$ 
BEGIN
    -- Create Presales status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'presales_status') THEN
        CREATE TYPE presales_status AS ENUM (
            'new',
            'contacted',
            'attention_needed',
            'follow_up_required',
            'waits_for_offer',
            'on_hold',
            'abandoned'
        );
    END IF;
    
    -- Create Customer status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_status') THEN
        CREATE TYPE customer_status AS ENUM (
            'active',
            'inactive'
        );
    END IF;
END $$;

-- Step 2: Add a new status_text column temporarily
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status_text TEXT;

-- Step 3: Map old statuses to new ones (for existing data)
UPDATE clients 
SET status_text = CASE
    WHEN status::text = 'new' THEN 'new'
    WHEN status::text = 'contacted' THEN 'contacted'
    WHEN status::text = 'in_progress' THEN 'follow_up_required'
    WHEN status::text = 'won' THEN 'active'
    WHEN status::text = 'lost' THEN 'abandoned'
    ELSE 'new'
END
WHERE status_text IS NULL;

-- Step 4: For customers, set appropriate status
UPDATE clients 
SET status_text = CASE
    WHEN client_type = 'customer' AND status_text IN ('won', 'active') THEN 'active'
    WHEN client_type = 'customer' THEN 'inactive'
    ELSE status_text
END
WHERE client_type = 'customer';

-- Step 5: Change status column to TEXT (we'll use TEXT instead of enum for flexibility)
ALTER TABLE clients ALTER COLUMN status TYPE TEXT USING status::text;

-- Step 6: Update status values from status_text
UPDATE clients SET status = status_text WHERE status_text IS NOT NULL;

-- Step 7: Drop the temporary column
ALTER TABLE clients DROP COLUMN IF EXISTS status_text;

-- Step 8: Add check constraints
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_presales_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_presales_check 
  CHECK (
    client_type != 'presales' OR 
    status IN ('new', 'contacted', 'attention_needed', 'follow_up_required', 'waits_for_offer', 'on_hold', 'abandoned')
  );

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_customer_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_customer_check 
  CHECK (
    client_type != 'customer' OR 
    status IN ('active', 'inactive')
  );

-- Note: The old client_status enum type will remain but won't be used.
-- You can drop it later if needed: DROP TYPE IF EXISTS client_status;


