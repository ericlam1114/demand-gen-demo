-- Simple Fix for Debtor Delete
-- This script directly drops and recreates policies without loops

-- Step 1: Drop ALL existing policies on affected tables
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON debtors;
DROP POLICY IF EXISTS "Users can view own agency debtors" ON debtors;
DROP POLICY IF EXISTS "Allow all operations on debtors" ON debtors;
DROP POLICY IF EXISTS "debtors_allow_all_dev" ON debtors;

DROP POLICY IF EXISTS "Enable full access for authenticated users" ON letters;
DROP POLICY IF EXISTS "Users can view own agency letters" ON letters;
DROP POLICY IF EXISTS "Allow all operations on letters" ON letters;
DROP POLICY IF EXISTS "letters_allow_all_dev" ON letters;

DROP POLICY IF EXISTS "Enable full access for authenticated users" ON debtor_workflows;
DROP POLICY IF EXISTS "Allow all debtor workflows access" ON debtor_workflows;
DROP POLICY IF EXISTS "Allow all operations on debtor_workflows" ON debtor_workflows;
DROP POLICY IF EXISTS "debtor_workflows_allow_all_dev" ON debtor_workflows;

DROP POLICY IF EXISTS "Enable full access for authenticated users" ON workflow_executions;
DROP POLICY IF EXISTS "Allow all workflow executions access" ON workflow_executions;
DROP POLICY IF EXISTS "Allow all operations on workflow_executions" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_allow_all_dev" ON workflow_executions;

DROP POLICY IF EXISTS "Enable full access for authenticated users" ON events;
DROP POLICY IF EXISTS "Users can view own agency events" ON events;
DROP POLICY IF EXISTS "Allow all operations on events" ON events;
DROP POLICY IF EXISTS "events_allow_all_dev" ON events;

-- Step 2: Create simple permissive policies
CREATE POLICY "delete_fix_debtors" ON debtors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "delete_fix_letters" ON letters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "delete_fix_debtor_workflows" ON debtor_workflows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "delete_fix_workflow_executions" ON workflow_executions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "delete_fix_events" ON events FOR ALL USING (true) WITH CHECK (true);

-- Step 3: Handle email_events if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_events') THEN
        -- Drop any existing policies
        DROP POLICY IF EXISTS "Enable full access for authenticated users" ON email_events;
        DROP POLICY IF EXISTS "Allow all operations on email_events" ON email_events;
        DROP POLICY IF EXISTS "email_events_allow_all_dev" ON email_events;
        
        -- Create new policy
        CREATE POLICY "delete_fix_email_events" ON email_events FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Step 4: Verify the fix
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('debtors', 'letters', 'debtor_workflows', 'workflow_executions', 'events', 'email_events')
  AND policyname LIKE 'delete_fix_%'
ORDER BY tablename; 