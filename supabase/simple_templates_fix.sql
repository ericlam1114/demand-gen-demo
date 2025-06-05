-- Simple templates table fix - add columns step by step

-- Add missing columns one by one
DO $$
BEGIN
    -- Add email_subject column (rename existing subject if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'templates' AND column_name = 'email_subject') THEN
        -- If subject exists, rename it to email_subject
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'templates' AND column_name = 'subject') THEN
            ALTER TABLE templates RENAME COLUMN subject TO email_subject;
        ELSE
            ALTER TABLE templates ADD COLUMN email_subject text;
        END IF;
    END IF;

    -- Add html_content column (rename existing html_body if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'templates' AND column_name = 'html_content') THEN
        -- If html_body exists, rename it to html_content
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'templates' AND column_name = 'html_body') THEN
            ALTER TABLE templates RENAME COLUMN html_body TO html_content;
        ELSE
            ALTER TABLE templates ADD COLUMN html_content text;
        END IF;
    END IF;

    -- Add channel column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'templates' AND column_name = 'channel') THEN
        ALTER TABLE templates ADD COLUMN channel text DEFAULT 'email';
    END IF;

    -- Add sms_content column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'templates' AND column_name = 'sms_content') THEN
        ALTER TABLE templates ADD COLUMN sms_content text;
    END IF;

    -- Add physical_content column if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'templates' AND column_name = 'physical_content') THEN
        ALTER TABLE templates ADD COLUMN physical_content text;
    END IF;

    -- Add is_default column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'templates' AND column_name = 'is_default') THEN
        ALTER TABLE templates ADD COLUMN is_default boolean DEFAULT false;
    END IF;

    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'templates' AND column_name = 'created_by') THEN
        ALTER TABLE templates ADD COLUMN created_by uuid;
    END IF;

    -- Remove version column if it exists (not used in new schema)
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'templates' AND column_name = 'version') THEN
        ALTER TABLE templates DROP COLUMN version;
    END IF;
END $$;

-- Update existing templates to have proper values
UPDATE templates 
SET channel = 'email' 
WHERE channel IS NULL OR channel = '';

UPDATE templates 
SET email_subject = 'Important Notice Regarding Your Account'
WHERE email_subject IS NULL OR email_subject = '';

-- Clear any existing problematic templates
DELETE FROM templates WHERE name IN ('Default Email Template', 'Default SMS Template', 'Default Physical Mail Template');

-- Create simple default templates
INSERT INTO templates (name, email_subject, html_content, channel, is_default) VALUES 
('Default Email Template', 'Outstanding Balance Notice', '<h1>Dear {{name}}</h1><p>You have an outstanding balance of ${{balance}}.</p>', 'email', true);

INSERT INTO templates (name, email_subject, sms_content, channel, is_default) VALUES 
('Default SMS Template', 'Account Notice', 'You have an outstanding balance of ${{balance}}. Please contact us.', 'sms', true);

INSERT INTO templates (name, email_subject, physical_content, channel, is_default) VALUES 
('Default Physical Mail Template', 'Outstanding Balance Notice', 'Dear {{name}}, You have an outstanding balance of ${{balance}}. Please remit payment.', 'physical', true); 