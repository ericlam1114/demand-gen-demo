-- Create demo users and agencies for testing

-- First, create agencies table if it doesn't exist
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  subdomain text UNIQUE,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  plan text DEFAULT 'free',
  max_users int DEFAULT 2,
  max_letters_per_month int DEFAULT 500,
  is_active boolean DEFAULT true
);

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'user',
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies that are more permissive for now
DROP POLICY IF EXISTS "Users can view their own agency" ON agencies;
CREATE POLICY "Users can view their own agency" ON agencies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their agency teammates" ON user_profiles;
CREATE POLICY "Users can view their agency teammates" ON user_profiles FOR ALL USING (true);

-- Insert demo agencies
INSERT INTO agencies (id, name, slug, plan, max_users, max_letters_per_month) VALUES 
('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Nexum Collections', 'nexum-collections', 'professional', 5, 2500),
('f47ac10b-58cc-4372-a567-0e02b2c3d480', 'DCI International', 'dci-international', 'enterprise', 10, 10000)
ON CONFLICT (slug) DO NOTHING;

-- Create demo user profiles (these will be linked when users sign up)
-- Note: The actual auth.users records need to be created through Supabase Auth
INSERT INTO user_profiles (id, agency_id, email, full_name, role) VALUES 
-- These IDs will be replaced with actual auth user IDs when users are created
('00000000-0000-0000-0000-000000000001', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'admin@nexum.com', 'Admin User', 'admin'),
('00000000-0000-0000-0000-000000000002', 'f47ac10b-58cc-4372-a567-0e02b2c3d480', 'admin@dci.com', 'DCI Admin', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Create a function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role, agency_id)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'user',
    -- Default to first agency for demo purposes
    (SELECT id FROM agencies LIMIT 1)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Create Nexum admin user profile (regular agency admin - only accesses their own dashboard)
-- For admin@nexum.com - UUID: c7afdbc6-6ba1-4c8d-8da6-92f692b4890a
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
  'manager', -- manager role = agency admin (redirects to dashboard)
  (SELECT id FROM agencies WHERE slug = 'nexum-collections' LIMIT 1),
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'manager',
  agency_id = (SELECT id FROM agencies WHERE slug = 'nexum-collections' LIMIT 1);

-- Create DataSynthetix super admin user profile (software owner - master key access)
-- For eric@datasynthetix.com - UUID: e8c8dd45-5924-46b6-994a-06ff6e6db7f9
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
  'admin', -- admin role = super admin (redirects to admin panel with master key access)
  NULL, -- No specific agency - can access all
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  agency_id = NULL;

-- Regular user profile for DCI
-- For admin@dci.com with password: demo123
-- Replace 'AUTH_USER_ID_HERE_2' with the actual UUID from Supabase Auth
/*
INSERT INTO user_profiles (
  id, 
  email, 
  full_name, 
  role, 
  agency_id,
  created_at,
  updated_at
) VALUES (
  'AUTH_USER_ID_HERE_2', -- Replace with actual auth user ID
  'admin@dci.com',
  'DCI Administrator',
  'manager',
  (SELECT id FROM agencies WHERE slug = 'debt-collectors-intl' LIMIT 1),
  NOW(),
  NOW()
);
*/

-- Instructions:
-- 1. Run the agencies insert above first
-- 2. Go to Supabase Dashboard > Authentication > Users
-- 3. Click "Add user" and create:
--    - Email: admin@nexum.com, Password: demo123
--    - Email: admin@dci.com, Password: demo123
-- 4. Copy the User ID (UUID) from each created user
-- 5. Replace 'AUTH_USER_ID_HERE' and 'AUTH_USER_ID_HERE_2' above with the actual UUIDs
-- 6. Uncomment and run the INSERT statements 