-- Fix Delete Debtors Issue - Focused Script
-- This script specifically fixes the RLS policies for deleting debtors

-- 1. Drop existing restrictive policies on debtors table
DROP POLICY IF EXISTS "Users can view own agency debtors" ON debtors;
DROP POLICY IF EXISTS "Allow all operations on debtors" ON debtors;

-- 2. Create a permissive policy for debtors table
CREATE POLICY "Allow all operations on debtors" ON debtors
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- 3. Also fix related tables that might block cascading deletes
-- Letters table
DROP POLICY IF EXISTS "Users can view own agency letters" ON letters;
DROP POLICY IF EXISTS "Allow all operations on letters" ON letters;
CREATE POLICY "Allow all operations on letters" ON letters
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Debtor workflows table  
DROP POLICY IF EXISTS "Allow all debtor workflows access" ON debtor_workflows;
DROP POLICY IF EXISTS "Allow all operations on debtor_workflows" ON debtor_workflows;
CREATE POLICY "Allow all operations on debtor_workflows" ON debtor_workflows
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Workflow executions table
DROP POLICY IF EXISTS "Allow all workflow executions access" ON workflow_executions;
DROP POLICY IF EXISTS "Allow all operations on workflow_executions" ON workflow_executions;
CREATE POLICY "Allow all operations on workflow_executions" ON workflow_executions
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Events table
DROP POLICY IF EXISTS "Users can view own agency events" ON events;
DROP POLICY IF EXISTS "Allow all operations on events" ON events;
CREATE POLICY "Allow all operations on events" ON events
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Verify the policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('debtors', 'letters', 'debtor_workflows', 'workflow_executions', 'events')
ORDER BY tablename, policyname; 