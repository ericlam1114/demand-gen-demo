-- Debug workflow issue for Nexum Collections
-- Agency ID: b0252af1-ccd8-4956-badf-c4dc9a3ff3c9

-- First, check all workflows for this agency
SELECT 
  w.id,
  w.name,
  w.agency_id,
  w.is_default,
  w.is_active,
  w.created_at,
  a.name as agency_name
FROM workflows w
LEFT JOIN agencies a ON a.id = w.agency_id
WHERE w.agency_id = 'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9'
ORDER BY w.created_at DESC;

-- Check what the CSV processor is looking for specifically
SELECT 
  w.id,
  w.name,
  'FOUND - This should work!' as status
FROM workflows w
WHERE w.agency_id = 'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9'
  AND w.is_default = true
  AND w.is_active = true;

-- Check for workflows that might have wrong agency_id (NULL or different)
SELECT 
  w.id,
  w.name,
  w.agency_id,
  w.is_default,
  w.is_active,
  CASE 
    WHEN w.agency_id IS NULL THEN 'NULL agency_id'
    WHEN w.agency_id != 'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9' THEN 'Wrong agency_id'
    WHEN w.is_default != true THEN 'Not marked as default'
    WHEN w.is_active != true THEN 'Not marked as active'
    ELSE 'Should work!'
  END as issue
FROM workflows w
WHERE w.name LIKE '%Demand Letter%' OR w.name LIKE '%Email Flow%';

-- Fix: Update the workflow to have correct agency_id and flags
UPDATE workflows 
SET 
  agency_id = 'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9',
  is_default = true,
  is_active = true,
  updated_at = NOW()
WHERE name = 'Demand Letter Email Flow'; 