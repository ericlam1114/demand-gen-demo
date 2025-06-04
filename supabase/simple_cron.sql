-- First, try to enable pg_cron (might work depending on your Supabase plan)
-- Run this in Supabase SQL Editor:

-- Check if pg_cron is available
SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';

-- If the above shows pg_cron, then run:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Simple cron job that runs every hour
-- Replace this with your actual site URL
-- SELECT cron.schedule(
--   'execute-workflows',
--   '0 * * * *',
--   'SELECT execute_workflows();'
-- );

-- Alternative: Create a webhook trigger instead
-- This creates a webhook you can call from external services
CREATE OR REPLACE FUNCTION trigger_workflow_execution()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN execute_workflows();
END;
$$;

-- Create a simple trigger function that can be called via webhook
-- You can set up a cron service like cron-job.org to call this
CREATE OR REPLACE FUNCTION public.webhook_execute_workflows()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT execute_workflows();
$$; 