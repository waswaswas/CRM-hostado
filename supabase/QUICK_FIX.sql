-- QUICK FIX: Add client_type column ONLY
-- Copy and paste ONLY the lines below (without the comments if you want)

ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT;

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE clients ADD CONSTRAINT clients_client_type_check CHECK (client_type IS NULL OR client_type IN ('presales', 'customer'));



