# Fix Delete Error - Row Level Security Issue

The delete error you're experiencing is due to Row Level Security (RLS) policies in Supabase that are preventing deletion operations.

## Quick Fix

Run this SQL in your Supabase SQL Editor:

```sql
-- Fix RLS policies to allow delete operations
DROP POLICY IF EXISTS "Users can view own agency debtors" ON debtors;

CREATE POLICY "Allow all operations on debtors" ON debtors
  FOR ALL 
  USING (true)
  WITH CHECK (true);
```

## Complete Fix (Recommended)

Run the entire fix script in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and run the contents of `supabase/fix_rls_policies.sql`

This will:
- Remove restrictive RLS policies
- Create permissive policies for development
- Allow all CRUD operations on all tables

## Alternative: Disable RLS Temporarily

If you just want to test quickly:

```sql
-- Disable RLS on debtors table (NOT recommended for production)
ALTER TABLE debtors DISABLE ROW LEVEL SECURITY;
ALTER TABLE letters DISABLE ROW LEVEL SECURITY;
ALTER TABLE debtor_workflows DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions DISABLE ROW LEVEL SECURITY;
```

## Production Considerations

For production, you should implement proper RLS policies that:
1. Check user authentication (`auth.uid()`)
2. Verify agency membership
3. Grant appropriate permissions per operation

Example production policy:
```sql
CREATE POLICY "Users can delete own agency debtors" ON debtors
  FOR DELETE 
  USING (
    agency_id IN (
      SELECT agency_id 
      FROM user_agencies 
      WHERE user_id = auth.uid()
    )
  );
```

## Debugging

The enhanced error logging will now show:
- Error code (42501 = insufficient privilege)
- Full error details
- Specific RLS policy violations

Check your browser console for `[Delete]` prefixed logs to see detailed error information. 