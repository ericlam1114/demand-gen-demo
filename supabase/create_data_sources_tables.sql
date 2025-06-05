-- Create tables for Data Sources & Integrations functionality

-- CSV Column Mappings table
CREATE TABLE IF NOT EXISTS csv_column_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  csv_column TEXT NOT NULL,
  system_field TEXT NOT NULL,
  is_required BOOLEAN DEFAULT false,
  validation_rule TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure unique mapping per agency per system field
  UNIQUE(agency_id, system_field)
);

-- API Integrations table
CREATE TABLE IF NOT EXISTS api_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'zoho', 'salesforce', 'hubspot', 'mysql', 'postgresql', 'custom_api'
  api_key TEXT NOT NULL,
  api_secret TEXT,
  endpoint_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'error'
  sync_error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure unique provider per agency
  UNIQUE(agency_id, provider)
);

-- RLS Policies for csv_column_mappings
ALTER TABLE csv_column_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their agency's column mappings" ON csv_column_mappings;
CREATE POLICY "Users can view their agency's column mappings" ON csv_column_mappings
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their agency's column mappings" ON csv_column_mappings;
CREATE POLICY "Users can manage their agency's column mappings" ON csv_column_mappings
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- RLS Policies for api_integrations
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their agency's integrations" ON api_integrations;
CREATE POLICY "Users can view their agency's integrations" ON api_integrations
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their agency's integrations" ON api_integrations;
CREATE POLICY "Users can manage their agency's integrations" ON api_integrations
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_csv_column_mappings_agency_id ON csv_column_mappings(agency_id);
CREATE INDEX IF NOT EXISTS idx_csv_column_mappings_system_field ON csv_column_mappings(system_field);
CREATE INDEX IF NOT EXISTS idx_api_integrations_agency_id ON api_integrations(agency_id);
CREATE INDEX IF NOT EXISTS idx_api_integrations_provider ON api_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_api_integrations_active ON api_integrations(is_active);

-- Add updated_at trigger for csv_column_mappings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_csv_column_mappings_updated_at ON csv_column_mappings;
CREATE TRIGGER update_csv_column_mappings_updated_at
    BEFORE UPDATE ON csv_column_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_integrations_updated_at ON api_integrations;
CREATE TRIGGER update_api_integrations_updated_at
    BEFORE UPDATE ON api_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample column mappings for demonstration
INSERT INTO csv_column_mappings (agency_id, created_by, csv_column, system_field, is_required, validation_rule) VALUES
  (
    (SELECT id FROM agencies WHERE name = 'Nexum Collections' LIMIT 1),
    (SELECT id FROM user_profiles WHERE email = 'eric@datasynthetix.com' LIMIT 1),
    'Customer Name', 'name', true, 'required'
  ),
  (
    (SELECT id FROM agencies WHERE name = 'Nexum Collections' LIMIT 1),
    (SELECT id FROM user_profiles WHERE email = 'eric@datasynthetix.com' LIMIT 1),
    'Email Address', 'email', true, 'email'
  ),
  (
    (SELECT id FROM agencies WHERE name = 'Nexum Collections' LIMIT 1),
    (SELECT id FROM user_profiles WHERE email = 'eric@datasynthetix.com' LIMIT 1),
    'Amount Owed', 'balance', true, 'currency'
  ),
  (
    (SELECT id FROM agencies WHERE name = 'Nexum Collections' LIMIT 1),
    (SELECT id FROM user_profiles WHERE email = 'eric@datasynthetix.com' LIMIT 1),
    'State', 'state', true, 'required'
  )
ON CONFLICT (agency_id, system_field) DO NOTHING; 