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

### Optional: Update Status Enum (if you want the new status values)

If you also want the new status values (to_be_contacted, waiting_for_response, etc.), run the full migration from `supabase/migration_add_client_type_and_status.sql` instead.

---

**Note:** The app will work with or without the new status enum values. The client_type column is the critical one that needs to be added.
