-- Add missing timestamp columns to letters table for audit trail

DO $$
BEGIN
    -- Add paid_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'paid_at') THEN
        ALTER TABLE letters ADD COLUMN paid_at timestamptz;
    END IF;

    -- Add escalated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'letters' AND column_name = 'escalated_at') THEN
        ALTER TABLE letters ADD COLUMN escalated_at timestamptz;
    END IF;

    -- Add metadata column to events table if it doesn't exist (for audit trail)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'metadata') THEN
        ALTER TABLE events ADD COLUMN metadata jsonb;
    END IF;
END $$;

-- Create indexes for performance on new timestamp columns
CREATE INDEX IF NOT EXISTS idx_letters_paid_at ON letters(paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_letters_escalated_at ON letters(escalated_at) WHERE escalated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_metadata ON events USING gin(metadata) WHERE metadata IS NOT NULL; 