-- Add additional fields to debtors table
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS zip text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS country text DEFAULT 'US';
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS original_creditor text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS notes text;

-- Create company settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
  company_name text NOT NULL,
  company_address text,
  company_city text,
  company_state text,
  company_zip text,
  company_phone text,
  company_email text,
  company_website text,
  company_logo_url text,
  license_number text,
  
  -- Email settings
  from_email text,
  from_name text,
  reply_to_email text,
  
  -- Letter settings
  letter_footer text,
  legal_disclaimer text,
  
  -- Branding
  primary_color text DEFAULT '#2563eb',
  secondary_color text DEFAULT '#64748b',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on company settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for company settings
CREATE POLICY "Allow all operations on company_settings" ON company_settings FOR ALL USING (true);

-- Insert default company settings
INSERT INTO company_settings (
  company_name,
  company_address,
  company_city,
  company_state,
  company_zip,
  company_phone,
  company_email,
  from_email,
  from_name,
  letter_footer,
  legal_disclaimer
) VALUES (
  'Nexum Collections',
  '123 Business Center Dr',
  'Los Angeles',
  'CA',
  '90210',
  '(555) 123-4567',
  'contact@nexumcollections.com',
  'collections@nexumcollections.com',
  'Nexum Collections',
  'This communication is from a debt collector. This is an attempt to collect a debt and any information obtained will be used for that purpose.',
  'Unless you notify this office within 30 days after receiving this notice that you dispute the validity of this debt or any portion thereof, this office will assume this debt is valid.'
) ON CONFLICT DO NOTHING; 