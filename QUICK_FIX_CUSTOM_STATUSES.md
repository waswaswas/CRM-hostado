# Quick Fix: Allow Custom Statuses

## Problem
You're getting this error when trying to use custom statuses:
```
new row for relation "clients" violates check constraint "clients_status_presales_check"
```

## Solution
Run this SQL in your Supabase SQL Editor to remove the restrictive constraints:

```sql
-- Remove existing status constraints to allow custom statuses
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_presales_check;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_customer_check;
```

## Steps:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Click "New query"
5. Copy and paste the SQL above
6. Click "Run" (or press Cmd/Ctrl + Enter)
7. Refresh your browser

After running this, you'll be able to use custom statuses like "test" without any errors!



















