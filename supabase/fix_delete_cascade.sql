-- Fix Cascade Delete for Debtors
-- This script ensures all related tables have proper RLS policies for cascade deletion

-- Step 1: Check current policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('debtors', 'letters', 'debtor_workflows', 'workflow_executions', 'events', 'email_events')
ORDER BY tablename;

-- Step 2: Drop ALL existing policies on affected tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on debtors
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'debtors') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON debtors', r.policyname);
    END LOOP;
    
    -- Drop all policies on letters
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'letters') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON letters', r.policyname);
    END LOOP;
    
    -- Drop all policies on debtor_workflows
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'debtor_workflows') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON debtor_workflows', r.policyname);
    END LOOP;
    
    -- Drop all policies on workflow_executions
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'workflow_executions') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON workflow_executions', r.policyname);
    END LOOP;
    
    -- Drop all policies on events
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'events') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON events', r.policyname);
    END LOOP;
    
    -- Drop all policies on email_events (if table exists)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'email_events') THEN
        FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'email_events') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON email_events', r.policyname);
        END LOOP;
    END IF;
END $$;

-- Step 3: Create new permissive policies for all tables
-- Using unique names to avoid conflicts

-- Debtors
CREATE POLICY "debtors_allow_all_dev" ON debtors
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Letters
CREATE POLICY "letters_allow_all_dev" ON letters
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Debtor workflows
CREATE POLICY "debtor_workflows_allow_all_dev" ON debtor_workflows
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Workflow executions
CREATE POLICY "workflow_executions_allow_all_dev" ON workflow_executions
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Events
CREATE POLICY "events_allow_all_dev" ON events
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Email events (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'email_events') THEN
        CREATE POLICY "email_events_allow_all_dev" ON email_events
          FOR ALL 
          USING (true)
          WITH CHECK (true);
    END IF;
END $$;

-- Step 4: Verify all policies are created correctly
SELECT 
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('debtors', 'letters', 'debtor_workflows', 'workflow_executions', 'events', 'email_events')
  AND policyname LIKE '%_dev'
ORDER BY tablename;

-- Step 5: Test that cascade constraints are properly set
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'debtors'
ORDER BY tc.table_name; 