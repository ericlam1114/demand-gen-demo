-- Add CASCADE DELETE to Foreign Keys
-- This script modifies foreign key constraints to cascade deletes

-- Step 1: Drop and recreate foreign key constraints with CASCADE

-- Letters table
ALTER TABLE letters 
  DROP CONSTRAINT IF EXISTS letters_debtor_id_fkey,
  ADD CONSTRAINT letters_debtor_id_fkey 
    FOREIGN KEY (debtor_id) 
    REFERENCES debtors(id) 
    ON DELETE CASCADE;

-- Debtor workflows table
ALTER TABLE debtor_workflows 
  DROP CONSTRAINT IF EXISTS debtor_workflows_debtor_id_fkey,
  ADD CONSTRAINT debtor_workflows_debtor_id_fkey 
    FOREIGN KEY (debtor_id) 
    REFERENCES debtors(id) 
    ON DELETE CASCADE;

-- Email events table (if it references debtors)
DO $$ 
BEGIN
    -- Check if the constraint exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'email_events_debtor_id_fkey'
    ) THEN
        ALTER TABLE email_events 
          DROP CONSTRAINT email_events_debtor_id_fkey,
          ADD CONSTRAINT email_events_debtor_id_fkey 
            FOREIGN KEY (debtor_id) 
            REFERENCES debtors(id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- Step 2: Handle cascading for workflow_executions (through debtor_workflows)
ALTER TABLE workflow_executions 
  DROP CONSTRAINT IF EXISTS workflow_executions_debtor_workflow_id_fkey,
  ADD CONSTRAINT workflow_executions_debtor_workflow_id_fkey 
    FOREIGN KEY (debtor_workflow_id) 
    REFERENCES debtor_workflows(id) 
    ON DELETE CASCADE;

-- Step 3: Handle cascading for events (through letters)
ALTER TABLE events 
  DROP CONSTRAINT IF EXISTS events_letter_id_fkey,
  ADD CONSTRAINT events_letter_id_fkey 
    FOREIGN KEY (letter_id) 
    REFERENCES letters(id) 
    ON DELETE CASCADE;

-- Step 4: Verify the cascade rules are set
SELECT
    tc.table_name AS child_table,
    kcu.column_name AS child_column,
    ccu.table_name AS parent_table,
    ccu.column_name AS parent_column,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
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

-- Also check constraints that reference tables that reference debtors
SELECT
    tc.table_name AS child_table,
    kcu.column_name AS child_column,
    ccu.table_name AS parent_table,
    ccu.column_name AS parent_column,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name IN ('letters', 'debtor_workflows')
ORDER BY tc.table_name; 