import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { agency_id } = await request.json()
    
    if (!agency_id) {
      return NextResponse.json(
        { error: 'Agency ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Create csv_column_mappings table if it doesn't exist
    try {
      await supabase.rpc('exec_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS csv_column_mappings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
            field_name TEXT NOT NULL,
            csv_column TEXT NOT NULL,
            validation_rule TEXT,
            is_required BOOLEAN DEFAULT false,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_csv_mappings_agency_id ON csv_column_mappings(agency_id);
          
          -- Enable RLS
          ALTER TABLE csv_column_mappings ENABLE ROW LEVEL SECURITY;
          
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Agency can manage their own CSV mappings" ON csv_column_mappings;
          
          -- Create RLS policy
          CREATE POLICY "Agency can manage their own CSV mappings" ON csv_column_mappings
          FOR ALL USING (agency_id IN (
            SELECT agencies.id FROM agencies
            JOIN user_profiles ON agencies.id = user_profiles.agency_id
            WHERE user_profiles.user_id = auth.uid()
          ));
        `
      })
    } catch (error) {
      console.error('Error creating csv_column_mappings table:', error)
    }

    // Create api_integrations table if it doesn't exist
    try {
      await supabase.rpc('exec_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS api_integrations (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
            provider TEXT NOT NULL,
            name TEXT NOT NULL,
            credentials JSONB,
            settings JSONB,
            is_active BOOLEAN DEFAULT false,
            last_sync_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_api_integrations_agency_id ON api_integrations(agency_id);
          
          -- Enable RLS
          ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;
          
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Agency can manage their own API integrations" ON api_integrations;
          
          -- Create RLS policy
          CREATE POLICY "Agency can manage their own API integrations" ON api_integrations
          FOR ALL USING (agency_id IN (
            SELECT agencies.id FROM agencies
            JOIN user_profiles ON agencies.id = user_profiles.agency_id
            WHERE user_profiles.user_id = auth.uid()
          ));
        `
      })
    } catch (error) {
      console.error('Error creating api_integrations table:', error)
    }

    // Insert sample data for the agency
    try {
      // Check if mappings already exist
      const { data: existingMappings } = await supabase
        .from('csv_column_mappings')
        .select('id')
        .eq('agency_id', agency_id)
        .limit(1)

      if (!existingMappings || existingMappings.length === 0) {
        // Insert sample CSV column mappings
        await supabase
          .from('csv_column_mappings')
          .insert([
            {
              agency_id,
              field_name: 'name',
              csv_column: 'Customer Name',
              validation_rule: 'required',
              is_required: true,
              description: 'Full name of the debtor'
            },
            {
              agency_id,
              field_name: 'email',
              csv_column: 'Email Address',
              validation_rule: 'email',
              is_required: true,
              description: 'Primary email address for contact'
            },
            {
              agency_id,
              field_name: 'phone',
              csv_column: 'Phone Number',
              validation_rule: 'phone',
              is_required: false,
              description: 'Primary phone number'
            },
            {
              agency_id,
              field_name: 'balance',
              csv_column: 'Amount Owed',
              validation_rule: 'currency',
              is_required: true,
              description: 'Outstanding debt amount'
            }
          ])
      }
    } catch (error) {
      console.error('Error inserting sample mappings:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Data sources initialized successfully'
    })

  } catch (error) {
    console.error('Init data sources error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize data sources' },
      { status: 500 }
    )
  }
} 