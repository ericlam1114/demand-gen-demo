-- SendGrid Integration Schema
-- Add missing columns to letters table for SendGrid tracking

-- First, check what columns exist and add only missing ones
DO $$
BEGIN
    -- Add tracking_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'tracking_id') THEN
        ALTER TABLE letters ADD COLUMN tracking_id text;
    END IF;

    -- Add sendgrid_message_id if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'sendgrid_message_id') THEN
        ALTER TABLE letters ADD COLUMN sendgrid_message_id text;
    END IF;

    -- Add open_count if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'open_count') THEN
        ALTER TABLE letters ADD COLUMN open_count int DEFAULT 0;
    END IF;

    -- Add click_count if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'click_count') THEN
        ALTER TABLE letters ADD COLUMN click_count int DEFAULT 0;
    END IF;

    -- Add delivered_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'delivered_at') THEN
        ALTER TABLE letters ADD COLUMN delivered_at timestamptz;
    END IF;

    -- Add clicked_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'clicked_at') THEN
        ALTER TABLE letters ADD COLUMN clicked_at timestamptz;
    END IF;

    -- Add bounced_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'bounced_at') THEN
        ALTER TABLE letters ADD COLUMN bounced_at timestamptz;
    END IF;

    -- Add bounce_reason if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'bounce_reason') THEN
        ALTER TABLE letters ADD COLUMN bounce_reason text;
    END IF;

    -- Add failed_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'failed_at') THEN
        ALTER TABLE letters ADD COLUMN failed_at timestamptz;
    END IF;

    -- Add failure_reason if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'failure_reason') THEN
        ALTER TABLE letters ADD COLUMN failure_reason text;
    END IF;

    -- Add spam_reported_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'spam_reported_at') THEN
        ALTER TABLE letters ADD COLUMN spam_reported_at timestamptz;
    END IF;

    -- Add unsubscribed_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'unsubscribed_at') THEN
        ALTER TABLE letters ADD COLUMN unsubscribed_at timestamptz;
    END IF;
END $$;

-- Create email_events table for storing SendGrid webhook events
CREATE TABLE IF NOT EXISTS email_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    letter_tracking_id text NOT NULL,
    debtor_id uuid REFERENCES debtors(id),
    event_type text NOT NULL,
    email_address text,
    timestamp timestamptz NOT NULL,
    sendgrid_event_id text,
    sendgrid_message_id text,
    user_agent text,
    ip_address text,
    url_clicked text,
    reason text,
    bounce_classification text,
    raw_event jsonb,
    created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_letters_tracking_id ON letters(tracking_id);
CREATE INDEX IF NOT EXISTS idx_letters_sendgrid_message_id ON letters(sendgrid_message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_tracking_id ON email_events(letter_tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_timestamp ON email_events(timestamp);

-- Enable RLS on email_events table
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for email_events
CREATE POLICY "Users can access email events for their agency letters" ON email_events
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM letters 
    JOIN debtors ON debtors.id = letters.debtor_id
    WHERE letters.tracking_id = email_events.letter_tracking_id
    AND debtors.agency_id = auth.uid()::uuid
  )
);

-- Database functions for incrementing counters
CREATE OR REPLACE FUNCTION increment_open_count(letter_tracking_id text)
RETURNS int AS $$
BEGIN
  UPDATE letters 
  SET open_count = COALESCE(open_count, 0) + 1
  WHERE tracking_id = letter_tracking_id;
  
  RETURN (SELECT COALESCE(open_count, 0) FROM letters WHERE tracking_id = letter_tracking_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_click_count(letter_tracking_id text)
RETURNS int AS $$
BEGIN
  UPDATE letters 
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE tracking_id = letter_tracking_id;
  
  RETURN (SELECT COALESCE(click_count, 0) FROM letters WHERE tracking_id = letter_tracking_id);
END;
$$ LANGUAGE plpgsql;

-- Update letter status enum to include new statuses
DO $$
BEGIN
    -- Add new enum values if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'delivered' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'letter_status')) THEN
        ALTER TYPE letter_status ADD VALUE 'delivered';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'clicked' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'letter_status')) THEN
        ALTER TYPE letter_status ADD VALUE 'clicked';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bounced' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'letter_status')) THEN
        ALTER TYPE letter_status ADD VALUE 'bounced';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'failed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'letter_status')) THEN
        ALTER TYPE letter_status ADD VALUE 'failed';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'spam' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'letter_status')) THEN
        ALTER TYPE letter_status ADD VALUE 'spam';
    END IF;
END $$; 