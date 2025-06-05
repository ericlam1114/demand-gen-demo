-- Minimal fix for templates table

-- Step 1: Fix existing html_body column if it exists
DO $$
BEGIN
    -- If html_body exists, make it nullable first, then rename
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'templates' AND column_name = 'html_body') THEN
        -- Remove NOT NULL constraint from html_body
        ALTER TABLE templates ALTER COLUMN html_body DROP NOT NULL;
        -- Rename to html_content
        ALTER TABLE templates RENAME COLUMN html_body TO html_content;
    END IF;
    
    -- If subject exists, rename to email_subject
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'templates' AND column_name = 'subject') THEN
        ALTER TABLE templates RENAME COLUMN subject TO email_subject;
    END IF;
END $$;

-- Step 2: Add missing columns
ALTER TABLE templates ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS html_content text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS channel text DEFAULT 'email';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS sms_content text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS physical_content text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS created_by uuid;

-- Step 3: Update existing data
UPDATE templates SET channel = 'email' WHERE channel IS NULL;
UPDATE templates SET email_subject = 'Important Notice' WHERE email_subject IS NULL;

-- Step 4: Clean up and insert simple templates
DELETE FROM templates WHERE name LIKE 'Default%Template';

-- Insert templates with proper NULL handling
INSERT INTO templates (name, email_subject, html_content, channel, is_default) VALUES 
('Default Email Template', 'Outstanding Balance Notice', '<p>Dear {{name}}, You owe ${{balance}}.</p>', 'email', true);

INSERT INTO templates (name, email_subject, sms_content, channel, is_default) VALUES 
('Default SMS Template', 'Account Notice', 'You owe ${{balance}}. Please pay.', 'sms', true);

INSERT INTO templates (name, email_subject, physical_content, channel, is_default) VALUES 
('Default Mail Template', 'Outstanding Balance', 'Dear {{name}}, You owe ${{balance}}.', 'physical', true); 