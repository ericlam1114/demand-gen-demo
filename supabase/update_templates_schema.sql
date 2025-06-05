-- Update templates table structure to match frontend expectations

-- Check if we need to add the new columns
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
        ALTER TABLE templates ADD COLUMN created_by uuid REFERENCES user_profiles(id);
    END IF;

    -- Remove version column if it exists (not used in new schema)
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'templates' AND column_name = 'version') THEN
        ALTER TABLE templates DROP COLUMN version;
    END IF;
END $$;

-- Update existing templates to have proper channel values
UPDATE templates 
SET channel = 'email' 
WHERE channel IS NULL OR channel = '';

-- Ensure email_subject has a default if empty
UPDATE templates 
SET email_subject = 'Important Notice Regarding Your Account'
WHERE email_subject IS NULL OR email_subject = '';

-- Create some default templates if none exist
INSERT INTO templates (
    name, 
    email_subject, 
    html_content, 
    channel, 
    is_default,
    agency_id
) 
SELECT 
    'Default Email Template',
    'Outstanding Balance Notice',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Demand Letter</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .amount { font-weight: bold; color: #d32f2f; }
        .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; }
    </style>
</head>
<body>
    <div class="header">
        <h1>NOTICE OF OUTSTANDING DEBT</h1>
    </div>
    
    <p>Dear {{name}},</p>
    
    <p>This letter serves as formal notice that you have an outstanding balance of 
    <span class="amount">${{balance}}</span> on your account.</p>
    
    <p>We have made previous attempts to contact you regarding this matter. 
    Please remit payment immediately to avoid further collection action.</p>
    
    <p><strong>Account Details:</strong></p>
    <ul>
        <li>Account Holder: {{name}}</li>
        <li>Outstanding Balance: ${{balance}}</li>
        <li>State: {{state}}</li>
    </ul>
    
    <p>If you believe this notice is in error, please contact our office immediately. 
    Otherwise, please remit payment within 30 days of the date of this letter.</p>
    
    <div class="footer">
        <p>Sincerely,<br>
        Collections Department</p>
        
        <p><small>This is an attempt to collect a debt. Any information obtained will be used for that purpose.</small></p>
    </div>
</body>
</html>',
    'email',
    true,
    null
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE is_default = true AND channel = 'email');

-- Create default SMS template
INSERT INTO templates (
    name, 
    sms_content, 
    channel, 
    is_default,
    agency_id
) 
SELECT 
    'Default SMS Template',
    'Important: You have an outstanding balance of ${{balance}}. Please contact us immediately to resolve this matter. Reply STOP to opt out.',
    'sms',
    true,
    null
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE is_default = true AND channel = 'sms');

-- Create default Physical Mail template
INSERT INTO templates (
    name, 
    physical_content, 
    channel, 
    is_default,
    agency_id
) 
SELECT 
    'Default Physical Mail Template',
    'Dear {{name}},

This letter serves as formal notice that you have an outstanding balance of ${{balance}} on your account.

We have made previous attempts to contact you regarding this matter. Please remit payment immediately to avoid further collection action.

Account Details:
- Account Holder: {{name}}
- Outstanding Balance: ${{balance}}
- State: {{state}}

If you believe this notice is in error, please contact our office immediately. Otherwise, please remit payment within 30 days of the date of this letter.

Sincerely,
Collections Department

This is an attempt to collect a debt. Any information obtained will be used for that purpose.',
    'physical',
    true,
    null
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE is_default = true AND channel = 'physical'); 