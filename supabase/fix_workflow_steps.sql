-- Fix workflows without steps
-- This script identifies workflows that don't have steps and adds default steps

-- First, let's see which workflows don't have steps
WITH workflows_without_steps AS (
  SELECT w.id, w.name, w.agency_id, w.is_default, w.is_active
  FROM workflows w
  LEFT JOIN workflow_steps ws ON ws.workflow_id = w.id
  WHERE ws.id IS NULL
  AND w.is_active = true
)
SELECT * FROM workflows_without_steps;

-- Fix workflows without steps by adding default email steps
DO $$
DECLARE
  workflow_record RECORD;
  template_id uuid;
BEGIN
  -- Get a default template (preferably email template)
  SELECT id INTO template_id 
  FROM templates 
  WHERE channel = 'email' OR channel IS NULL
  LIMIT 1;
  
  -- If no template exists, create a basic one
  IF template_id IS NULL THEN
    INSERT INTO templates (
      name,
      description,
      html_content,
      email_subject,
      channel,
      created_at,
      updated_at
    ) VALUES (
      'Default Demand Letter',
      'Basic demand letter template',
      '<p>Dear {{debtor_name}},</p>
<p>This letter is to inform you that you have an outstanding balance of ${{balance_amount}} on your account ({{account_number}}).</p>
<p>Please contact us immediately at {{company_phone}} to arrange payment and avoid further collection activity.</p>
<p>Sincerely,<br>{{company_name}}</p>
<p style="font-size: 12px; color: #666; margin-top: 40px;">{{letter_footer}}</p>',
      'Important: Outstanding Balance Notice - {{debtor_name}}',
      'email',
      NOW(),
      NOW()
    ) RETURNING id INTO template_id;
  END IF;
  
  -- For each workflow without steps, add default 3-step email process
  FOR workflow_record IN 
    SELECT w.id, w.name, w.agency_id
    FROM workflows w
    LEFT JOIN workflow_steps ws ON ws.workflow_id = w.id
    WHERE ws.id IS NULL
    AND w.is_active = true
  LOOP
    RAISE NOTICE 'Adding steps to workflow: % (%)', workflow_record.name, workflow_record.id;
    
    -- Insert 3 default email steps
    INSERT INTO workflow_steps (workflow_id, step_number, step_type, delay_days, delay_hours, template_id, created_at)
    VALUES 
      (workflow_record.id, 1, 'email', 0, 0, template_id, NOW()),   -- Immediate
      (workflow_record.id, 2, 'email', 7, 0, template_id, NOW()),   -- 7 days later
      (workflow_record.id, 3, 'email', 14, 0, template_id, NOW());  -- 14 days later
  END LOOP;
END $$;

-- Fix any debtor_workflows with invalid current_step_number
UPDATE debtor_workflows dw
SET current_step_number = 1,
    next_action_at = NOW()
WHERE NOT EXISTS (
  SELECT 1 
  FROM workflow_steps ws 
  WHERE ws.workflow_id = dw.workflow_id 
  AND ws.step_number = dw.current_step_number
)
AND dw.status = 'active';

-- Verify the fix
SELECT 
  w.id,
  w.name,
  w.agency_id,
  w.is_active,
  COUNT(ws.id) as step_count,
  COUNT(DISTINCT dw.id) as active_debtor_count
FROM workflows w
LEFT JOIN workflow_steps ws ON ws.workflow_id = w.id
LEFT JOIN debtor_workflows dw ON dw.workflow_id = w.id AND dw.status = 'active'
GROUP BY w.id, w.name, w.agency_id, w.is_active
ORDER BY w.created_at DESC; 