-- Fix admin@nexum.com user profile to link to Nexum Collections

-- First, ensure Nexum Collections agency exists
INSERT INTO agencies (name, slug, plan, max_users, max_letters_per_month) VALUES 
  ('Nexum Collections', 'nexum-collections', 'professional', 5, 2500)
ON CONFLICT (slug) DO UPDATE SET
  plan = 'professional',
  max_users = 5,
  max_letters_per_month = 2500;

-- Create/update the user profile for admin@nexum.com
-- Using the actual UUID from Supabase Auth: c7afdbc6-6ba1-4c8d-8da6-92f692b4890a
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
  email = 'admin@nexum.com',
  full_name = 'Nexum Administrator',
  role = 'manager',
  agency_id = (SELECT id FROM agencies WHERE slug = 'nexum-collections' LIMIT 1),
  updated_at = NOW();

-- Verify the fix
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.role,
  a.name as agency_name,
  a.plan
FROM user_profiles up
JOIN agencies a ON a.id = up.agency_id
WHERE up.email = 'admin@nexum.com'; 