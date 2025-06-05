import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/integration - Get integration status and available endpoints
export async function GET() {
  return NextResponse.json({
    status: 'active',
    version: '1.0',
    endpoints: {
      debtors: {
        create: 'POST /api/integration/debtors',
        bulk_create: 'POST /api/integration/debtors/bulk',
        update: 'PUT /api/integration/debtors/{id}',
        get: 'GET /api/integration/debtors/{id}',
        list: 'GET /api/integration/debtors'
      },
      campaigns: {
        create: 'POST /api/integration/campaigns',
        status: 'GET /api/integration/campaigns/{id}/status',
        stop: 'POST /api/integration/campaigns/{id}/stop'
      },
      webhooks: {
        setup: 'POST /api/integration/webhooks',
        test: 'POST /api/integration/webhooks/test'
      },
      reports: {
        campaign_performance: 'GET /api/integration/reports/campaign-performance',
        export: 'GET /api/integration/reports/export'
      }
    },
    webhook_events: [
      'letter.sent',
      'letter.opened', 
      'letter.bounced',
      'response.received',
      'campaign.completed'
    ]
  })
}

// POST /api/integration - Create integration session with authentication
export async function POST(request) {
  try {
    const { api_key, agency_slug } = await request.json()
    
    if (!api_key || !agency_slug) {
      return NextResponse.json(
        { error: 'API key and agency slug required' }, 
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    
    // Verify API key and get agency
    const { data: agency, error } = await supabase
      .from('agencies')
      .select('id, name, slug, is_active')
      .eq('slug', agency_slug)
      .eq('is_active', true)
      .single()

    if (error || !agency) {
      return NextResponse.json(
        { error: 'Invalid agency or API key' }, 
        { status: 401 }
      )
    }

    // For now, we'll use a simple API key validation
    // In production, this would be more sophisticated
    if (api_key !== `${agency.slug}_api_key_${agency.id.slice(0, 8)}`) {
      return NextResponse.json(
        { error: 'Invalid API key' }, 
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      agency: {
        id: agency.id,
        name: agency.name,
        slug: agency.slug
      },
      session_token: `session_${Date.now()}_${agency.id}`,
      expires_in: 3600
    })

  } catch (error) {
    console.error('Integration auth error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' }, 
      { status: 500 }
    )
  }
} 