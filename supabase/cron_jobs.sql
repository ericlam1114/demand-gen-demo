-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job that runs every hour to execute workflows
-- This will call our Edge Function which in turn calls the workflow execution API
SELECT cron.schedule(
  'execute-workflows-hourly',  -- Job name
  '0 * * * *',                 -- Cron expression: every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://your-project-id.supabase.co/functions/v1/execute-workflows',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.anon_key', true)
      ),
      body := jsonb_build_object()
    ) as request_id;
  $$
);

-- Alternative: Run every 30 minutes
-- SELECT cron.schedule(
--   'execute-workflows-30min',
--   '*/30 * * * *',
--   $$
--   SELECT
--     net.http_post(
--       url := 'https://your-project-id.supabase.co/functions/v1/execute-workflows',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.anon_key', true)
--       ),
--       body := jsonb_build_object()
--     ) as request_id;
--   $$
-- );

-- View all cron jobs
-- SELECT * FROM cron.job;

-- Delete a cron job (if needed)
-- SELECT cron.unschedule('execute-workflows-hourly'); 