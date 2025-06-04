-- Workflow system database schema

-- Workflows table - stores workflow definitions
CREATE TABLE workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id),
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workflow steps - individual actions in a workflow
CREATE TABLE workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  step_type text NOT NULL, -- 'email', 'sms', 'physical', 'wait', 'condition'
  delay_days int DEFAULT 0, -- Days to wait before executing this step
  delay_hours int DEFAULT 0, -- Additional hours to wait
  template_id uuid REFERENCES templates(id),
  conditions jsonb, -- For conditional logic
  created_at timestamptz DEFAULT now()
);

-- Debtor workflow assignments - tracks which debtors are in which workflows
CREATE TABLE debtor_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id uuid REFERENCES debtors(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES workflows(id),
  current_step_number int DEFAULT 1,
  status text DEFAULT 'active', -- 'active', 'paused', 'completed', 'cancelled'
  started_at timestamptz DEFAULT now(),
  next_action_at timestamptz, -- When the next step should execute
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Workflow executions - tracks individual step executions
CREATE TABLE workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_workflow_id uuid REFERENCES debtor_workflows(id) ON DELETE CASCADE,
  workflow_step_id uuid REFERENCES workflow_steps(id),
  step_number int NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'executing', 'completed', 'failed', 'skipped'
  scheduled_at timestamptz NOT NULL,
  executed_at timestamptz,
  letter_id uuid REFERENCES letters(id), -- If this execution created a letter
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtor_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own agency workflows" ON workflows
  FOR ALL USING (agency_id = auth.uid()::uuid OR agency_id IS NULL);

CREATE POLICY "Users can view own agency workflow steps" ON workflow_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workflows 
      WHERE workflows.id = workflow_steps.workflow_id 
      AND (workflows.agency_id = auth.uid()::uuid OR workflows.agency_id IS NULL)
    )
  );

CREATE POLICY "Users can view own agency debtor workflows" ON debtor_workflows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM debtors 
      WHERE debtors.id = debtor_workflows.debtor_id 
      AND (debtors.agency_id = auth.uid()::uuid OR debtors.agency_id IS NULL)
    )
  );

CREATE POLICY "Users can view own agency workflow executions" ON workflow_executions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM debtor_workflows 
      JOIN debtors ON debtors.id = debtor_workflows.debtor_id
      WHERE debtor_workflows.id = workflow_executions.debtor_workflow_id 
      AND (debtors.agency_id = auth.uid()::uuid OR debtors.agency_id IS NULL)
    )
  );

-- Create indexes for performance
CREATE INDEX idx_workflows_agency_id ON workflows(agency_id);
CREATE INDEX idx_workflows_is_default ON workflows(is_default) WHERE is_default = true;
CREATE INDEX idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_step_number ON workflow_steps(workflow_id, step_number);
CREATE INDEX idx_debtor_workflows_debtor_id ON debtor_workflows(debtor_id);
CREATE INDEX idx_debtor_workflows_workflow_id ON debtor_workflows(workflow_id);
CREATE INDEX idx_debtor_workflows_next_action ON debtor_workflows(next_action_at) WHERE status = 'active';
CREATE INDEX idx_workflow_executions_scheduled ON workflow_executions(scheduled_at) WHERE status = 'pending';

-- Insert default workflow
INSERT INTO workflows (id, agency_id, name, description, is_default, is_active) VALUES 
(
  gen_random_uuid(),
  null, -- Will be updated when we have proper auth
  'Default Demand Letter Workflow',
  'Standard 3-step demand letter process: Initial demand → 7-day reminder → 14-day final notice',
  true,
  true
);

-- Get the workflow ID for steps (using a variable)
DO $$
DECLARE
  default_workflow_id uuid;
  default_template_id uuid;
BEGIN
  -- Get the default workflow ID
  SELECT id INTO default_workflow_id FROM workflows WHERE is_default = true LIMIT 1;
  
  -- Get the default template ID
  SELECT id INTO default_template_id FROM templates LIMIT 1;
  
  -- Insert workflow steps
  INSERT INTO workflow_steps (workflow_id, step_number, step_type, delay_days, delay_hours, template_id) VALUES
  (default_workflow_id, 1, 'email', 0, 0, default_template_id),     -- Immediate email
  (default_workflow_id, 2, 'email', 7, 0, default_template_id),     -- 7-day reminder  
  (default_workflow_id, 3, 'email', 14, 0, default_template_id);    -- 14-day final notice
END $$; 