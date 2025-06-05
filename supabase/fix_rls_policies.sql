-- Fix RLS policies and ensure proper user profile access

-- First, drop conflicting policies on user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins and managers can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their agency teammates" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage team members" ON user_profiles;

-- Drop conflicting policies on agencies
DROP POLICY IF EXISTS "Users can view own agency" ON agencies;
DROP POLICY IF EXISTS "Users can view their own agency" ON agencies;
DROP POLICY IF EXISTS "Admins can update their agency" ON agencies;

-- Ensure the user_profiles table has the correct structure
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Update role check constraint to allow all role types
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('admin', 'manager', 'user', 'member'));

-- Create simpler, more permissive RLS policies for user_profiles
CREATE POLICY "Enable full access for authenticated users" 
  ON user_profiles FOR ALL 
  USING (auth.uid() IS NOT NULL);

-- Create simpler policy for agencies 
CREATE POLICY "Enable full access for authenticated users" 
  ON agencies FOR ALL 
  USING (auth.uid() IS NOT NULL);

-- Also ensure other tables have permissive policies for now
DROP POLICY IF EXISTS "Users can view own agency debtors" ON debtors;
DROP POLICY IF EXISTS "Users can access debtors in their agency" ON debtors;
CREATE POLICY "Enable full access for authenticated users" 
  ON debtors FOR ALL 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own agency letters" ON letters;
DROP POLICY IF EXISTS "Users can access letters in their agency" ON letters;
CREATE POLICY "Enable full access for authenticated users" 
  ON letters FOR ALL 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own agency events" ON events;
CREATE POLICY "Enable full access for authenticated users" 
  ON events FOR ALL 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own agency templates" ON templates;
DROP POLICY IF EXISTS "Users can access templates in their agency" ON templates;
CREATE POLICY "Enable full access for authenticated users" 
  ON templates FOR ALL 
  USING (auth.uid() IS NOT NULL);

-- Ensure workflow tables have permissive policies too
DROP POLICY IF EXISTS "Users can view own agency workflows" ON workflows;
DROP POLICY IF EXISTS "Allow all operations on workflows" ON workflows;
CREATE POLICY "Enable full access for authenticated users" 
  ON workflows FOR ALL 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own agency workflow steps" ON workflow_steps;
DROP POLICY IF EXISTS "Allow all operations on workflow_steps" ON workflow_steps;
CREATE POLICY "Enable full access for authenticated users" 
  ON workflow_steps FOR ALL 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own agency debtor workflows" ON debtor_workflows;
DROP POLICY IF EXISTS "Allow all operations on debtor_workflows" ON debtor_workflows;
CREATE POLICY "Enable full access for authenticated users" 
  ON debtor_workflows FOR ALL 
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own agency workflow executions" ON workflow_executions;
DROP POLICY IF EXISTS "Allow all operations on workflow_executions" ON workflow_executions;
CREATE POLICY "Enable full access for authenticated users" 
  ON workflow_executions FOR ALL 
  USING (auth.uid() IS NOT NULL);

-- Drop existing company_settings policies
DROP POLICY IF EXISTS "Allow all operations on company_settings" ON company_settings;
DROP POLICY IF EXISTS "Users can access company settings in their agency" ON company_settings;
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON company_settings;

-- Create proper RLS policies for company_settings
CREATE POLICY "Users can view their agency settings" ON company_settings
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their agency settings" ON company_settings
  FOR INSERT WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their agency settings" ON company_settings
  FOR UPDATE USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Ensure company_settings has proper structure
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id);
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id);
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_company_settings_agency_id ON company_settings(agency_id);

-- Ensure sample data exists with proper structure
INSERT INTO agencies (name, slug, plan, max_users, max_letters_per_month) VALUES 
  ('Nexum Collections', 'nexum-collections', 'professional', 5, 2500),
  ('Debt Collectors International', 'debt-collectors-intl', 'enterprise', 10, 10000),
  ('Premier Recovery Solutions', 'premier-recovery', 'starter', 2, 500)
ON CONFLICT (slug) DO UPDATE SET
  plan = EXCLUDED.plan,
  max_users = EXCLUDED.max_users,
  max_letters_per_month = EXCLUDED.max_letters_per_month;

-- Ensure demo users exist (these should match the auth users created in Supabase Dashboard)
INSERT INTO user_profiles (
  id, 
  email, 
  full_name, 
  role, 
  agency_id,
  created_at,
  updated_at
) VALUES (
  'c7afdbc6-6ba1-4c8d-8da6-92f692b4890a',
  'admin@nexum.com',
  'Nexum Administrator',
  'manager',
  (SELECT id FROM agencies WHERE slug = 'nexum-collections' LIMIT 1),
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'manager',
  agency_id = (SELECT id FROM agencies WHERE slug = 'nexum-collections' LIMIT 1),
  full_name = 'Nexum Administrator',
  email = 'admin@nexum.com';

INSERT INTO user_profiles (
  id, 
  email, 
  full_name, 
  role, 
  agency_id,
  created_at,
  updated_at
) VALUES (
  'e8c8dd45-5924-46b6-994a-06ff6e6db7f9',
  'eric@datasynthetix.com',
  'Eric Lam - DataSynthetix',
  'admin',
  NULL, -- Super admin has no specific agency
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  agency_id = NULL,
  full_name = 'Eric Lam - DataSynthetix',
  email = 'eric@datasynthetix.com';

-- Fix RLS policies for development
-- This script creates permissive policies for testing

-- First, handle user_profiles table if it exists
DO $$ 
BEGIN
    -- Drop existing policy on user_profiles if it exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_profiles') THEN
        DROP POLICY IF EXISTS "Enable full access for authenticated users" ON user_profiles;
        DROP POLICY IF EXISTS "Allow all operations on user_profiles" ON user_profiles;
    END IF;
END $$;

-- Drop existing policies on debtors table
DROP POLICY IF EXISTS "Users can view own agency debtors" ON debtors;

-- Create permissive policies for development
-- WARNING: These policies allow all operations - only use for development!

-- Debtors table - allow all operations
CREATE POLICY "Allow all operations on debtors" ON debtors
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Letters table - allow all operations
DROP POLICY IF EXISTS "Users can view own agency letters" ON letters;
CREATE POLICY "Allow all operations on letters" ON letters
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Events table - allow all operations  
DROP POLICY IF EXISTS "Users can view own agency events" ON events;
CREATE POLICY "Allow all operations on events" ON events
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Templates table - allow all operations
DROP POLICY IF EXISTS "Users can view own agency templates" ON templates;
CREATE POLICY "Allow all operations on templates" ON templates
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Agencies table - allow all operations
DROP POLICY IF EXISTS "Users can view own agency" ON agencies;
CREATE POLICY "Allow all operations on agencies" ON agencies
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Workflow related tables (if they have RLS enabled)
DROP POLICY IF EXISTS "Users can view own agency workflows" ON workflows;
DROP POLICY IF EXISTS "Allow all workflow access" ON workflows;
CREATE POLICY "Allow all operations on workflows" ON workflows FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can view own agency workflow steps" ON workflow_steps;
DROP POLICY IF EXISTS "Allow all workflow steps access" ON workflow_steps;
CREATE POLICY "Allow all operations on workflow_steps" ON workflow_steps FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all debtor workflows access" ON debtor_workflows;
CREATE POLICY "Allow all operations on debtor_workflows" ON debtor_workflows FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all workflow executions access" ON workflow_executions;
CREATE POLICY "Allow all operations on workflow_executions" ON workflow_executions FOR ALL USING (true);

-- Company settings
DROP POLICY IF EXISTS "Users can access company settings" ON company_settings;
CREATE POLICY "Allow all operations on company_settings" ON company_settings FOR ALL USING (true);

-- Note: For production, you should implement proper RLS policies that check:
-- 1. User authentication (auth.uid())
-- 2. User's agency membership
-- 3. Appropriate permissions for each operation (SELECT, INSERT, UPDATE, DELETE) 