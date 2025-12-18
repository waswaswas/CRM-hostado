# Database Migration Instructions

## Quick Fix: Add client_type Column

The error "Could not find the 'client_type' column" means you need to run a migration in Supabase.

### Step 1: Go to Supabase SQL Editor
1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/maaafptvqlqsvqcfkkzd
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Run the Simple Migration

Copy and paste this SQL (this ONLY adds the column, doesn't touch existing types):

```sql
-- Add client_type column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT;

-- Add check constraint
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE clients ADD CONSTRAINT clients_client_type_check 
  CHECK (client_type IS NULL OR client_type IN ('presales', 'customer'));
```

**Important:** If you get an error about "type already exists", ignore it - that means you tried to run the full migration. Just run the SQL above instead (it only adds the column).

### Step 3: Click "Run"

After running this, refresh your application and the error should be gone.

### Step 3: Update Status System (Optional but Recommended)

After adding the client_type column, you can update the status system to use the new Presales/Customer statuses.

**Run this SQL** (from `supabase/migration_status_simple.sql`):

```sql
-- Step 1: Change status to TEXT
ALTER TABLE clients ALTER COLUMN status TYPE TEXT USING status::text;

-- Step 2: Update existing statuses to new values
UPDATE clients 
SET status = CASE
  WHEN status = 'new' THEN 'new'
  WHEN status = 'contacted' THEN 'contacted'
  WHEN status = 'in_progress' THEN 'follow_up_required'
  WHEN status = 'won' THEN 
    CASE 
      WHEN client_type = 'customer' THEN 'active'
      ELSE 'new'
    END
  WHEN status = 'lost' THEN 'abandoned'
  WHEN status = 'to_be_contacted' THEN 'new'
  WHEN status = 'waiting_for_response' THEN 'contacted'
  WHEN status = 'waiting_for_offer' THEN 'waits_for_offer'
  ELSE 'new'
END
WHERE status IS NOT NULL;

-- Step 3: Fix customer statuses
UPDATE clients 
SET status = 'active'
WHERE client_type = 'customer' AND status NOT IN ('active', 'inactive');

-- Step 4: Fix presales statuses
UPDATE clients 
SET status = 'new'
WHERE client_type = 'presales' 
  AND status NOT IN ('new', 'contacted', 'attention_needed', 'follow_up_required', 'waits_for_offer', 'on_hold', 'abandoned');

-- Step 5: Add constraints
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
```

---

**Note:** The app will work with or without the new status values. The client_type column is the critical one that needs to be added first.



