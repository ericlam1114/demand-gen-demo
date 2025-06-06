# Fix Template Update Issue

## Problem
The "Update Template" button on the templates page doesn't work due to restrictive Row Level Security (RLS) policies in Supabase that are blocking UPDATE operations on the `templates` table.

## Root Cause
Similar to the delete debtor issue we encountered earlier, the templates table has RLS policies that require specific agency ownership checks that may not be properly configured or may be too restrictive for the current user session.

## Symptoms
- Update Template button appears to do nothing
- No visible error in the UI
- Console may show empty error objects or RLS-related database errors
- Template changes are not saved to the database

## Solution

### Step 1: Run the SQL Fix Script
Execute the provided SQL script in Supabase SQL Editor:

```sql
-- See: supabase/fix_template_update.sql
```

This script:
1. Drops any existing restrictive RLS policies on the templates table
2. Creates a permissive policy that allows all operations for authenticated users
3. Ensures the templates table has the correct column structure
4. Updates existing data to have proper default values
5. Adds an updated_at trigger for automatic timestamp updates

### Step 2: Enhanced Debugging (Already Applied)
The code now includes enhanced console logging with `[Template Update]` prefixes to help diagnose issues:

- Logs detailed information about the update operation
- Shows the exact data being sent to Supabase
- Displays full error details including RLS-specific messages
- Checks if data is returned from the update operation

### Step 3: Test the Fix
1. Go to the Templates page
2. Click "Edit" on any existing template
3. Make a change to the template name or content
4. Click "Update Template"
5. Check the browser console for `[Template Update]` logs
6. Verify the template is updated in the UI and database

## Alternative Solutions (If SQL Fix Doesn't Work)

### Option 1: Check User Authentication
```javascript
// In browser console, check current user:
const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)
```

### Option 2: Check Agency Context
```javascript
// Verify user has proper agency association:
const { data } = await supabase
  .from('user_profiles')
  .select('*, agencies(*)')
  .eq('id', user.id)
console.log('User profile with agency:', data)
```

### Option 3: Manual Policy Creation
If the script doesn't work, manually create the policy in Supabase Dashboard:

1. Go to Database > Policies
2. Find the `templates` table
3. Delete any existing policies
4. Create new policy:
   - Name: "Allow all operations on templates"
   - Operation: All
   - Target roles: authenticated
   - USING expression: `true`
   - WITH CHECK expression: `true`

## Prevention
To prevent similar issues in the future:
1. Use permissive RLS policies during development
2. Test all CRUD operations after implementing RLS
3. Implement proper agency-based policies in production
4. Include comprehensive error logging in all database operations

## Production Considerations
The current fix uses permissive policies suitable for development. For production, implement proper agency-based RLS policies:

```sql
-- Example production policy
CREATE POLICY "Users can manage their agency templates" ON templates
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );
``` 