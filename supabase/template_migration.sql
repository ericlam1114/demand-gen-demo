-- Add SMS and Physical Mail template fields to existing templates table
ALTER TABLE templates ADD COLUMN IF NOT EXISTS sms_body text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS physical_body text; 