-- Create demo users and profiles
-- Note: This script creates the profile records, but you'll need to manually create the auth users in Supabase Dashboard

-- First, let's make sure we have the agencies
INSERT INTO agencies (name, slug, plan, max_users, max_letters_per_month) VALUES 
  ('Nexum Collections', 'nexum-collections', 'professional', 5, 2500),
  ('Debt Collectors International', 'debt-collectors-intl', 'enterprise', 10, 10000),
  ('Premier Recovery Solutions', 'premier-recovery', 'starter', 2, 500)
ON CONFLICT (slug) DO NOTHING;

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

-- Create regular user profile for DCI
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
-- 1. ✅ DONE: Created admin@nexum.com with UUID c7afdbc6-6ba1-4c8d-8da6-92f692b4890a
-- 2. ✅ DONE: Run the INSERT for Nexum admin above
-- 3. ✅ DONE: Created eric@datasynthetix.com with UUID e8c8dd45-5924-46b6-994a-06ff6e6db7f9
-- 4. ✅ DONE: Run the INSERT for DataSynthetix super admin above
-- 5. 🔄 OPTIONAL: Create admin@dci.com if you want a third demo account

-- Role explanations:
-- 'admin' = Super admin (DataSynthetix) - gets master key access to admin panel, can switch between all agencies
-- 'manager' = Agency admin (Nexum, DCI, etc.) - goes directly to their agency dashboard, no master key access
-- 'user' = Regular agency user - limited access within their agency

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