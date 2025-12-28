-- Allow Custom Statuses
-- This removes the restrictive CHECK constraints on the status column
-- so that custom statuses can be used

-- Remove existing status constraints
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_presales_check;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_customer_check;

-- The status column is already TEXT, so it can accept any string value
-- No need to add new constraints - we want to allow custom statuses

-- Note: The app will handle validation of which statuses are valid
-- based on the client_type and custom_statuses from the settings table
















