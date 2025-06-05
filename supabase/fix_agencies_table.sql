-- Fix agencies table by adding missing columns and updating data

-- Add missing columns to agencies table if they don't exist
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS subdomain text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan text DEFAULT 'starter';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS max_users int DEFAULT 2;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS max_letters_per_month int DEFAULT 500;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Update existing agencies with slug values if they don't have them
UPDATE agencies SET 
  slug = 'nexum-collections',
  plan = 'professional',
  max_users = 5,
  max_letters_per_month = 2500
WHERE name = 'Nexum Collections' AND slug IS NULL;

UPDATE agencies SET 
  slug = 'debt-collectors-intl',
  plan = 'enterprise', 
  max_users = 10,
  max_letters_per_month = 10000
WHERE name = 'Debt Collectors International' AND slug IS NULL;

UPDATE agencies SET 
  slug = 'premier-recovery',
  plan = 'starter',
  max_users = 2, 
  max_letters_per_month = 500
WHERE name = 'Premier Recovery Solutions' AND slug IS NULL;

-- Add unique constraints after updating data (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agencies_slug_unique') THEN
ALTER TABLE agencies ADD CONSTRAINT agencies_slug_unique UNIQUE (slug);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agencies_subdomain_unique') THEN
ALTER TABLE agencies ADD CONSTRAINT agencies_subdomain_unique UNIQUE (subdomain);
    END IF;
END $$;

-- Insert sample agencies (this will now work)
INSERT INTO agencies (name, slug, plan, max_users, max_letters_per_month) VALUES 
  ('Nexum Collections', 'nexum-collections', 'professional', 5, 2500),
  ('Debt Collectors International', 'debt-collectors-intl', 'enterprise', 10, 10000),
  ('Premier Recovery Solutions', 'premier-recovery', 'starter', 2, 500)
ON CONFLICT (slug) DO NOTHING; 