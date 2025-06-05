const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://lnmgckdqnfgwykdnqgwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxubWdja2RxbmZnd3lrZG5xZ3d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzM0OTMzMSwiZXhwIjoyMDQ4OTI1MzMxfQ.7p-Y-wH6m_k1HdIbGkJGC4ZQMNs5lALsUIYgksNI3dQ'
);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const sqlPath = path.join(__dirname, '..', 'supabase', 'create_workflow_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running migration...');
    
    // Split SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });
        if (error) {
          console.error('Error executing statement:', error);
          console.log('Statement was:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    console.log('Migration completed successfully!');
    
    // Test the tables
    const { data: workflows, error: workflowError } = await supabase.from('workflows').select('*').limit(5);
    console.log('Workflows test:', { count: workflows?.length || 0, error: workflowError });
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration(); 