import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Webhook event types and their payload structures
const WEBHOOK_EVENTS = {
  'letter.sent': {
    description: 'Letter was successfully sent to debtor',
    payload: ['letter_id', 'debtor_id', 'external_id', 'email', 'template_name', 'sent_at']
  },
  'letter.opened': {
    description: 'Letter was opened by debtor (tracking pixel loaded)',
    payload: ['letter_id', 'debtor_id', 'external_id', 'email', 'opened_at', 'ip_address']
  },
  'letter.bounced': {
    description: 'Letter bounced (invalid email)',
    payload: ['letter_id', 'debtor_id', 'external_id', 'email', 'bounce_reason', 'bounced_at']
  },
  'response.received': {
    description: 'Debtor replied to letter',
    payload: ['letter_id', 'debtor_id', 'external_id', 'email', 'response_type', 'message', 'received_at']
  },
  'campaign.completed': {
    description: 'Workflow campaign completed for debtor',
    payload: ['debtor_id', 'external_id', 'workflow_id', 'workflow_name', 'final_status', 'completed_at']
  },
  'payment.received': {
    description: 'Payment received notification',
    payload: ['debtor_id', 'external_id', 'amount', 'payment_method', 'received_at']
  }
}

// Store webhook configurations in memory (in production, use database)
const webhookConfigs = new Map()

// Helper function to validate agency API access
async function validateApiAccess(request) {
  const authHeader = request.headers.get('Authorization')
  const agencySlug = request.headers.get('X-Agency-Slug')
  
  if (!authHeader || !agencySlug) {
    throw new Error('Missing authorization or agency slug')
  }

  const apiKey = authHeader.replace('Bearer ', '')
  const supabase = createServerClient()
  
  const { data: agency, error } = await supabase
    .from('agencies')
    .select('id, name, slug')
    .eq('slug', agencySlug)
    .eq('is_active', true)
    .single()

  if (error || !agency) {
    throw new Error('Invalid agency')
  }

  if (apiKey !== `${agency.slug}_api_key_${agency.id.slice(0, 8)}`) {
    throw new Error('Invalid API key')
  }

  return agency
}

// Function to send webhook notification
export async function sendWebhook(agencyId, event, payload) {
  const config = webhookConfigs.get(agencyId)
  if (!config || !config.url || !config.events.includes(event)) {
    return false
  }

  try {
    const webhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      agency_id: agencyId,
      data: payload
    }

    // Create signature for verification
    const signature = await createSignature(JSON.stringify(webhookPayload), config.secret)

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'User-Agent': 'DemandGen-Webhooks/1.0'
      },
      body: JSON.stringify(webhookPayload),
      timeout: 10000 // 10 second timeout
    })

    if (!response.ok) {
      console.error(`Webhook failed for agency ${agencyId}: ${response.status}`)
      return false
    }

    console.log(`Webhook sent successfully for agency ${agencyId}, event: ${event}`)
    return true

  } catch (error) {
    console.error(`Webhook error for agency ${agencyId}:`, error)
    return false
  }
}

// Create HMAC signature for webhook verification
async function createSignature(payload, secret) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// GET /api/webhooks - Get webhook configuration
export async function GET(request) {
  try {
    const agency = await validateApiAccess(request)
    const config = webhookConfigs.get(agency.id)

    return NextResponse.json({
      success: true,
      webhook: config ? {
        url: config.url,
        events: config.events,
        active: config.active,
        created_at: config.created_at
      } : null,
      available_events: WEBHOOK_EVENTS
    })

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to get webhook configuration' }, 
      { status: error.message.includes('Invalid') ? 401 : 500 }
    )
  }
}

// POST /api/webhooks - Configure webhook
export async function POST(request) {
  try {
    const agency = await validateApiAccess(request)
    const { url, events, secret } = await request.json()

    if (!url || !Array.isArray(events) || !secret) {
      return NextResponse.json(
        { error: 'URL, events array, and secret are required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Validate events
    const validEvents = Object.keys(WEBHOOK_EVENTS)
    const invalidEvents = events.filter(event => !validEvents.includes(event))
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(', ')}` },
        { status: 400 }
      )
    }

    // Store webhook configuration
    webhookConfigs.set(agency.id, {
      url,
      events,
      secret,
      active: true,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Webhook configured successfully',
      webhook: {
        url,
        events,
        active: true
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to configure webhook' }, 
      { status: error.message.includes('Invalid') ? 401 : 500 }
    )
  }
}

// DELETE /api/webhooks - Remove webhook configuration
export async function DELETE(request) {
  try {
    const agency = await validateApiAccess(request)
    
    const existed = webhookConfigs.has(agency.id)
    webhookConfigs.delete(agency.id)

    return NextResponse.json({
      success: true,
      message: existed ? 'Webhook removed successfully' : 'No webhook was configured'
    })

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to remove webhook' }, 
      { status: error.message.includes('Invalid') ? 401 : 500 }
    )
  }
} 