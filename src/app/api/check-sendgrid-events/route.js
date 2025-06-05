import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Check for SendGrid events in the database
    const { data: events, error } = await supabase
      .from('email_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    // Check letters with SendGrid message IDs
    const { data: letters, error: lettersError } = await supabase
      .from('letters')
      .select('id, tracking_id, sendgrid_message_id, status, sent_at, channel')
      .not('sendgrid_message_id', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(5)

    // Check today's sent letters
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data: todaysLetters, error: todaysError } = await supabase
      .from('letters')
      .select('*')
      .eq('channel', 'email')
      .gte('sent_at', today.toISOString())
      .order('sent_at', { ascending: false })

    return NextResponse.json({
      emailEvents: {
        count: events?.length || 0,
        events: events || []
      },
      lettersWithSendGridId: {
        count: letters?.length || 0,
        letters: letters || []
      },
      todaysEmailsSent: {
        count: todaysLetters?.length || 0,
        letters: todaysLetters?.map(l => ({
          id: l.id,
          sent_at: l.sent_at,
          status: l.status,
          tracking_id: l.tracking_id,
          sendgrid_message_id: l.sendgrid_message_id
        }))
      },
      webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://your-app.com'}/api/sendgrid-webhook`
    })

  } catch (error) {
    console.error('Check events error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 