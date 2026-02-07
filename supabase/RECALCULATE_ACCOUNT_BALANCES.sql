-- Recalculate account balances from transactions
-- Use this when balances are wrong (e.g. after fixing double-counting or bulk import)
-- Run in Supabase SQL Editor as a superuser or with appropriate permissions.

-- Step 1: Disable the balance trigger to avoid conflicts during bulk update
ALTER TABLE transactions DISABLE TRIGGER trigger_update_account_balance;

-- Step 2: Reset each account's current_balance to opening_balance + net transactions
-- Formula: current_balance = opening_balance + SUM(income) - SUM(expense)
-- Transfers are stored as separate expense (from) and income (to) rows, so each is counted once.
UPDATE accounts a
SET 
  current_balance = COALESCE(a.opening_balance, 0) + COALESCE(
    (SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
     FROM transactions t
     WHERE t.account_id = a.id),
    0
  ),
  updated_at = TIMEZONE('utc'::text, NOW());

-- Step 3: Re-enable the trigger for future inserts/updates/deletes
ALTER TABLE transactions ENABLE TRIGGER trigger_update_account_balance;

-- Optional: Verify totals (run separately to check)
-- SELECT a.name, a.opening_balance, a.current_balance
-- FROM accounts a
-- ORDER BY a.name;
