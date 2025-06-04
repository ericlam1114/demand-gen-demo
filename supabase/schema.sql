-- Enable RLS
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create enum types
CREATE TYPE letter_status AS ENUM ('draft','sent','opened','paid','escalated');

-- Agencies table (for multi-tenant support)
CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Per debtor row from CSV
CREATE TABLE debtors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id),
  name text NOT NULL,
  email text NOT NULL,
  balance_cents int NOT NULL,
  state text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Stored HTML templates with Handlebars tokens {{name}}
CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id),
  name text NOT NULL,
  version int DEFAULT 1,
  html_body text NOT NULL,
  subject text NOT NULL DEFAULT 'Important Notice Regarding Your Account',
  created_at timestamptz DEFAULT now()
);

-- One letter per debtor per escalation step
CREATE TABLE letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id uuid REFERENCES debtors(id),
  template_id uuid REFERENCES templates(id),
  channel text DEFAULT 'email',
  status letter_status DEFAULT 'draft',
  sent_at timestamptz,
  opened_at timestamptz,
  pdf_url text,
  html_url text,
  created_at timestamptz DEFAULT now()
);

-- Audit / analytics
CREATE TABLE events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  letter_id uuid REFERENCES letters(id),
  type text NOT NULL, -- 'sent'|'opened'|'paid'|'escalated'
  recorded_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (assuming auth.uid() corresponds to agency_id for now)
-- In production, you'd have a users table linking to agencies

-- Agencies: users can only see their own agency
CREATE POLICY "Users can view own agency" ON agencies
  FOR SELECT USING (id = auth.uid()::uuid);

-- Debtors: users can only access debtors in their agency
CREATE POLICY "Users can view own agency debtors" ON debtors
  FOR ALL USING (agency_id = auth.uid()::uuid);

-- Templates: users can only access templates in their agency
CREATE POLICY "Users can view own agency templates" ON templates
  FOR ALL USING (agency_id = auth.uid()::uuid);

-- Letters: users can only access letters for debtors in their agency
CREATE POLICY "Users can view own agency letters" ON letters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM debtors 
      WHERE debtors.id = letters.debtor_id 
      AND debtors.agency_id = auth.uid()::uuid
    )
  );

-- Events: users can only access events for letters in their agency
CREATE POLICY "Users can view own agency events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM letters 
      JOIN debtors ON debtors.id = letters.debtor_id
      WHERE letters.id = events.letter_id 
      AND debtors.agency_id = auth.uid()::uuid
    )
  );

-- Insert default template
INSERT INTO templates (id, agency_id, name, subject, html_body) VALUES 
(
  gen_random_uuid(),
  null, -- Will be updated when we have proper auth
  'Default Demand Letter',
  'Important Notice Regarding Your Account Balance',
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
  
  <p>If you believe this notice is in error, please contact our office immediately 
  at the number below. Otherwise, please remit payment within 30 days of the date 
  of this letter.</p>
  
  <div class="footer">
    <p>Sincerely,<br>
    Collections Department<br>
    Nexum Collections</p>
    
    <p><small>This is an attempt to collect a debt. Any information obtained will be used for that purpose.</small></p>
  </div>
  
  <img src="{{tracking_pixel_url}}" width="1" height="1" style="display:none;" />
</body>
</html>'
);

-- Create indexes for performance
CREATE INDEX idx_debtors_agency_id ON debtors(agency_id);
CREATE INDEX idx_letters_debtor_id ON letters(debtor_id);
CREATE INDEX idx_letters_status ON letters(status);
CREATE INDEX idx_events_letter_id ON events(letter_id);
CREATE INDEX idx_events_type ON events(type); 