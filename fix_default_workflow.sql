-- Fix default workflow for Nexum Collections
-- Agency ID: b0252af1-ccd8-4956-badf-c4dc9a3ff3c9

-- Update existing workflow to have correct agency_id
UPDATE workflows 
SET 
  agency_id = 'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9',
  is_default = true,
  is_active = true,
  updated_at = NOW()
WHERE name = 'Demand Letter Email Flow'
  OR name LIKE '%Demand Letter%'
  OR name LIKE '%Email Flow%';

-- If no existing workflow, create a default one
INSERT INTO workflows (
  agency_id,
  name,
  description,
  is_default,
  is_active,
  created_at,
  updated_at
) 
SELECT 
  'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9',
  'Demand Letter Email Flow',
  'Standard 3-step demand letter process for Nexum Collections',
  true,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM workflows 
  WHERE agency_id = 'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9' 
  AND is_default = true
);

-- Get the workflow ID for creating steps
DO $$
DECLARE
  wf_id uuid;
  template_id uuid;
BEGIN
  -- Get the default workflow ID for this agency
  SELECT id INTO wf_id 
  FROM workflows 
  WHERE agency_id = 'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9' 
  AND is_default = true 
  LIMIT 1;
  
  -- Get any available template ID (or create a basic one)
  SELECT id INTO template_id FROM templates LIMIT 1;
  
  -- If no template exists, create a basic one
  IF template_id IS NULL THEN
    INSERT INTO templates (
      name,
      description,
      html_content,
      email_subject,
      agency_id,
      created_at,
      updated_at
    ) VALUES (
      'Basic Demand Letter',
      'Standard demand letter template',
      '<p>Dear {{name}},</p><p>This is to inform you that you have an outstanding balance of ${{balance}} that requires immediate attention.</p><p>Please contact us to resolve this matter.</p>',
      'Outstanding Balance Notice',
      'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9',
      NOW(),
      NOW()
    ) RETURNING id INTO template_id;
  END IF;
  
  -- Only create steps if we have a workflow and no existing steps
  IF wf_id IS NOT NULL THEN
    -- Check if steps already exist
    IF NOT EXISTS (SELECT 1 FROM workflow_steps WHERE workflow_id = wf_id) THEN
      -- Insert workflow steps
      INSERT INTO workflow_steps (workflow_id, step_number, step_type, delay_days, delay_hours, template_id, created_at) VALUES
      (wf_id, 1, 'email', 0, 0, template_id, NOW()),     -- Immediate email
      (wf_id, 2, 'email', 7, 0, template_id, NOW()),     -- 7-day reminder  
      (wf_id, 3, 'email', 14, 0, template_id, NOW());    -- 14-day final notice
    END IF;
  END IF;
END $$;

-- Verify the setup (fixed query)
SELECT 
  w.id,
  w.name,
  w.agency_id,
  w.is_default,
  w.is_active,
  w.created_at,
  COUNT(ws.id) as step_count
FROM workflows w
LEFT JOIN workflow_steps ws ON ws.workflow_id = w.id
WHERE w.agency_id = 'b0252af1-ccd8-4956-badf-c4dc9a3ff3c9'
GROUP BY w.id, w.name, w.agency_id, w.is_default, w.is_active, w.created_at
ORDER BY w.is_default DESC, w.created_at; 