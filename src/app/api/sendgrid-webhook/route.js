import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import crypto from 'crypto'

// SendGrid webhook event handler
export async function POST(request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-twilio-email-event-webhook-signature')
    const timestamp = request.headers.get('x-twilio-email-event-webhook-timestamp')

    // Verify webhook signature (recommended for production)
    if (process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY)
        .update(timestamp + body)
        .digest('base64')

      if (signature !== expectedSignature) {
        console.error('Invalid SendGrid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      // Log warning if verification is disabled
      console.warn('[SendGrid Webhook] Running without signature verification - not recommended for production')
    }

    const events = JSON.parse(body)
    const supabase = createServerClient()

    console.log(`Received ${events.length} SendGrid events`)

    for (const event of events) {
      try {
        await processEvent(supabase, event)
      } catch (error) {
        console.error('Error processing SendGrid event:', error, event)
      }
    }

    return NextResponse.json({ success: true, processed: events.length })

  } catch (error) {
    console.error('SendGrid webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processEvent(supabase, event) {
  const {
    event: eventType,
    email,
    timestamp,
    sg_message_id,
    sg_event_id,
    useragent,
    ip,
    url,
    reason,
    bounce_classification,
    ...customArgs
  } = event

  // Extract our custom tracking data
  const letterId = customArgs.letter_id || customArgs['letter_id']
  const debtorId = customArgs.debtor_id || customArgs['debtor_id']

  if (!letterId) {
    console.log('No letter_id found in SendGrid event:', event)
    return
  }

  // Update letter with SendGrid message ID if we don't have it yet
  if (sg_message_id) {
    await supabase
      .from('letters')
      .update({ sendgrid_message_id: sg_message_id })
      .eq('tracking_id', letterId)
      .is('sendgrid_message_id', null)
  }

  // Record the event
  const eventData = {
    letter_tracking_id: letterId,
    debtor_id: debtorId ? parseInt(debtorId) : null,
    event_type: eventType,
    email_address: email,
    timestamp: new Date(timestamp * 1000).toISOString(),
    sendgrid_event_id: sg_event_id,
    sendgrid_message_id: sg_message_id,
    user_agent: useragent,
    ip_address: ip,
    url_clicked: url,
    reason: reason,
    bounce_classification: bounce_classification,
    raw_event: event
  }

  // Insert event record
  const { error: eventError } = await supabase
    .from('email_events')
    .insert(eventData)

  if (eventError) {
    console.error('Error inserting email event:', eventError)
    return
  }

  // Update letter status based on event type
  await updateLetterStatus(supabase, letterId, eventType, eventData)

  console.log(`Processed ${eventType} event for letter ${letterId}`)
}

async function updateLetterStatus(supabase, letterId, eventType, eventData) {
  let updateData = {}

  switch (eventType) {
    case 'delivered':
      updateData = { 
        status: 'delivered',
        delivered_at: eventData.timestamp
      }
      break

    case 'open':
      updateData = { 
        status: 'opened',
        opened_at: eventData.timestamp,
        open_count: supabase.rpc('increment_open_count', { letter_tracking_id: letterId })
      }
      break

    case 'click':
      updateData = { 
        status: 'clicked',
        clicked_at: eventData.timestamp,
        click_count: supabase.rpc('increment_click_count', { letter_tracking_id: letterId })
      }
      break

    case 'bounce':
      updateData = { 
        status: 'bounced',
        bounced_at: eventData.timestamp,
        bounce_reason: eventData.reason
      }
      break

    case 'dropped':
      updateData = { 
        status: 'failed',
        failed_at: eventData.timestamp,
        failure_reason: eventData.reason
      }
      break

    case 'spam_report':
      updateData = { 
        status: 'spam',
        spam_reported_at: eventData.timestamp
      }
      break

    case 'unsubscribe':
      updateData = { 
        unsubscribed_at: eventData.timestamp
      }
      break
  }

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('letters')
      .update(updateData)
      .eq('tracking_id', letterId)

    if (error) {
      console.error('Error updating letter status:', error)
    }
  }
}

// Helper database functions (to be run in Supabase)
/*
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
*/ 