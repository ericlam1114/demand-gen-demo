-- Fix Template Update Issue
-- This script addresses RLS policies that may be blocking template updates

-- Drop any existing restrictive policies on templates table
DROP POLICY IF EXISTS "Users can view own agency templates" ON templates;
DROP POLICY IF EXISTS "Users can access templates in their agency" ON templates;
DROP POLICY IF EXISTS "Allow all operations on templates" ON templates;
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON templates;

-- Create a permissive policy for templates table for development
CREATE POLICY "Allow all operations on templates" ON templates
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Also ensure the templates table has the correct structure
ALTER TABLE templates ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS html_content text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS channel text DEFAULT 'email';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS sms_content text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS physical_content text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Update existing templates to have proper channel values
UPDATE templates 
SET channel = 'email' 
WHERE channel IS NULL OR channel = '';

-- Ensure email_subject has a default if empty
UPDATE templates 
SET email_subject = 'Important Notice Regarding Your Account'
WHERE email_subject IS NULL OR email_subject = '';

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_templates_updated_at_trigger ON templates;
CREATE TRIGGER update_templates_updated_at_trigger
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_templates_updated_at();

-- Verify the policy was created successfully
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'templates'
ORDER BY policyname; 