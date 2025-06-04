-- Multi-tenant schema with agencies and user management

-- Agencies table (the main tenant entity)
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL, -- URL-friendly identifier like 'nexum-collections'
  subdomain text UNIQUE, -- Optional subdomain like 'nexum.collections.app'
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Subscription/billing info
  plan text DEFAULT 'starter', -- starter, professional, enterprise
  max_users int DEFAULT 2,
  max_letters_per_month int DEFAULT 500,
  is_active boolean DEFAULT true
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'member', -- admin, manager, member
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User invitations for team management
CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES user_profiles(id),
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Update existing tables to enforce agency isolation
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id);
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id);
ALTER TABLE letters ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id);

-- Update company_settings to be agency-specific
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id);

-- Enable RLS on all tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for proper data isolation

-- Agencies: Users can only see their own agency
CREATE POLICY "Users can view their own agency" ON agencies FOR SELECT USING (
  id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can update their agency" ON agencies FOR UPDATE USING (
  id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- User profiles: Users can see teammates in their agency
CREATE POLICY "Users can view their agency teammates" ON user_profiles FOR SELECT USING (
  agency_id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can manage team members" ON user_profiles FOR ALL USING (
  agency_id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Debtors: Only accessible within same agency
CREATE POLICY "Users can access debtors in their agency" ON debtors FOR ALL USING (
  agency_id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
);

-- Workflows: Only accessible within same agency  
CREATE POLICY "Users can access workflows in their agency" ON workflows FOR ALL USING (
  agency_id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
);

-- Templates: Only accessible within same agency
CREATE POLICY "Users can access templates in their agency" ON templates FOR ALL USING (
  agency_id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
);

-- Letters: Only accessible within same agency
CREATE POLICY "Users can access letters in their agency" ON letters FOR ALL USING (
  debtor_id IN (
    SELECT id FROM debtors WHERE agency_id IN (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  )
);

-- Company settings: Only accessible within same agency
CREATE POLICY "Users can access company settings in their agency" ON company_settings FOR ALL USING (
  agency_id IN (SELECT agency_id FROM user_profiles WHERE id = auth.uid())
);

-- Insert sample agencies
INSERT INTO agencies (name, slug, plan, max_users, max_letters_per_month) VALUES 
  ('Nexum Collections', 'nexum-collections', 'professional', 5, 2500),
  ('Debt Collectors International', 'debt-collectors-intl', 'enterprise', 10, 10000),
  ('Premier Recovery Solutions', 'premier-recovery', 'starter', 2, 500)
ON CONFLICT (slug) DO NOTHING;

-- Function to get current user's agency
CREATE OR REPLACE FUNCTION get_current_agency_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Function to check if user is admin/manager
CREATE OR REPLACE FUNCTION is_agency_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$; 