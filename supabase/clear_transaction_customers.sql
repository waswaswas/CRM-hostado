-- Clear all accounting_customer_id from transactions
-- This resets all customer associations so they can be reassigned

UPDATE transactions 
SET accounting_customer_id = NULL
WHERE accounting_customer_id IS NOT NULL;



