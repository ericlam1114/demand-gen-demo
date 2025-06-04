-- Part 1: Create workflow tables (run this first)
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  step_type text NOT NULL,
  delay_days int DEFAULT 0,
  delay_hours int DEFAULT 0,
  template_id uuid REFERENCES templates(id),
  conditions jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debtor_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id uuid REFERENCES debtors(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES workflows(id),
  current_step_number int DEFAULT 1,
  status text DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  next_action_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_workflow_id uuid REFERENCES debtor_workflows(id) ON DELETE CASCADE,
  workflow_step_id uuid REFERENCES workflow_steps(id),
  step_number int NOT NULL,
  status text DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL,
  executed_at timestamptz,
  letter_id uuid REFERENCES letters(id),
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Part 2: Enable RLS (run this second)
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtor_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Part 3: Create policies (run this third)
CREATE POLICY "Allow all operations on workflows" ON workflows FOR ALL USING (true);
CREATE POLICY "Allow all operations on workflow_steps" ON workflow_steps FOR ALL USING (true);
CREATE POLICY "Allow all operations on debtor_workflows" ON debtor_workflows FOR ALL USING (true);
CREATE POLICY "Allow all operations on workflow_executions" ON workflow_executions FOR ALL USING (true);

-- Part 4: Add indexes (run this fourth)
CREATE INDEX IF NOT EXISTS idx_workflows_is_default ON workflows(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_debtor_workflows_next_action ON debtor_workflows(next_action_at) WHERE status = 'active';

-- Part 5: Insert default workflow (run this last)
INSERT INTO workflows (name, description, is_default, is_active) 
VALUES ('Default Demand Letter Workflow', 'Standard 3-step demand letter process', true, true)
ON CONFLICT DO NOTHING; 