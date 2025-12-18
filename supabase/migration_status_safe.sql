-- Safe Status Migration
-- This updates existing data first, then adds constraints
-- Run this step by step if needed

-- Step 1: Change status column to TEXT (allows flexible status values)
ALTER TABLE clients ALTER COLUMN status TYPE TEXT USING status::text;

-- Step 2: Update existing statuses to new values
-- Map old statuses to new presales statuses
UPDATE clients 
SET status = CASE
  WHEN status = 'new' THEN 'new'
  WHEN status = 'contacted' THEN 'contacted'
  WHEN status = 'in_progress' THEN 'follow_up_required'
  WHEN status = 'won' THEN 
    CASE 
      WHEN client_type = 'customer' THEN 'active'
      ELSE 'new'  -- For presales, treat 'won' as new
    END
  WHEN status = 'lost' THEN 'abandoned'
  WHEN status = 'to_be_contacted' THEN 'new'
  WHEN status = 'waiting_for_response' THEN 'contacted'
  WHEN status = 'waiting_for_offer' THEN 'waits_for_offer'
  ELSE 'new'  -- Default to 'new' for any unknown status
END
WHERE status IS NOT NULL;

-- Step 3: For customers, set appropriate status if not already set
UPDATE clients 
SET status = CASE
  WHEN client_type = 'customer' AND status NOT IN ('active', 'inactive') THEN 'active'
  ELSE status
END
WHERE client_type = 'customer';

-- Step 4: For presales without valid status, set to 'new'
UPDATE clients 
SET status = 'new'
WHERE client_type = 'presales' 
  AND status NOT IN ('new', 'contacted', 'attention_needed', 'follow_up_required', 'waits_for_offer', 'on_hold', 'abandoned');

-- Step 5: Now add the check constraints (data is already cleaned)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_presales_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_presales_check 
  CHECK (
    client_type IS NULL OR
    client_type != 'presales' OR 
    status IN ('new', 'contacted', 'attention_needed', 'follow_up_required', 'waits_for_offer', 'on_hold', 'abandoned')
  );

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_customer_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_customer_check 
  CHECK (
    client_type IS NULL OR
    client_type != 'customer' OR 
    status IN ('active', 'inactive')
  );


