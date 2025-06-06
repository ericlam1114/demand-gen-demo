-- Fix any letters that have status='opened' by changing them back to 'sent'
-- We're removing the 'opened' status and tracking opens via opened_at timestamp instead

UPDATE letters
SET status = 'sent'
WHERE status = 'opened';

-- Verify the change
SELECT 
  COUNT(*) as count,
  status
FROM letters
GROUP BY status
ORDER BY status; 