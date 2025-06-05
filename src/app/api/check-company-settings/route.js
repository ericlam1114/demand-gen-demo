import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    const { data: settings, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      console.error('Settings query error:', error)
    }

    return NextResponse.json({
      hasSettings: !!settings,
      settings: settings || null,
      fromEmail: settings?.from_email || process.env.FROM_EMAIL || 'collections@example.com',
      envFromEmail: process.env.FROM_EMAIL
    })

  } catch (error) {
    console.error('Check settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 