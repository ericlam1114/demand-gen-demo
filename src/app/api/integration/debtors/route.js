import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

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

  // Simple API key validation
  if (apiKey !== `${agency.slug}_api_key_${agency.id.slice(0, 8)}`) {
    throw new Error('Invalid API key')
  }

  return agency
}

// GET /api/integration/debtors - List debtors for external system
export async function GET(request) {
  try {
    const agency = await validateApiAccess(request)
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const status = searchParams.get('status')
    const campaign_id = searchParams.get('campaign_id')
    
    const supabase = createServerClient()
    let query = supabase
      .from('debtors')
      .select(`
        id,
        name,
        email,
        balance_cents,
        state,
        phone,
        account_number,
        created_at,
        debtor_workflows!inner (
          id,
          status,
          current_step_number,
          workflow_id,
          workflows (
            name
          )
        )
      `)
      .eq('agency_id', agency.id)
      .range((page - 1) * limit, page * limit - 1)

    if (status) {
      query = query.eq('debtor_workflows.status', status)
    }

    const { data: debtors, error } = await query

    if (error) throw error

    // Format response for external system
    const formattedDebtors = debtors.map(debtor => ({
      id: debtor.id,
      external_id: debtor.account_number,
      name: debtor.name,
      email: debtor.email,
      balance: (debtor.balance_cents / 100).toFixed(2),
      state: debtor.state,
      phone: debtor.phone,
      campaign_status: debtor.debtor_workflows[0]?.status || 'not_enrolled',
      current_step: debtor.debtor_workflows[0]?.current_step_number || 0,
      workflow_name: debtor.debtor_workflows[0]?.workflows?.name,
      created_at: debtor.created_at
    }))

    return NextResponse.json({
      success: true,
      data: formattedDebtors,
      pagination: {
        page,
        limit,
        total: formattedDebtors.length,
        has_more: formattedDebtors.length === limit
      }
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch debtors' }, 
      { status: error.message.includes('Invalid') ? 401 : 500 }
    )
  }
}

// POST /api/integration/debtors - Create single debtor
export async function POST(request) {
  try {
    const agency = await validateApiAccess(request)
    const debtorData = await request.json()
    
    // Validate required fields
    const { name, email, balance, external_id } = debtorData
    if (!name || !email || !balance) {
      return NextResponse.json(
        { error: 'Name, email, and balance are required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    
    // Check for existing debtor by external_id
    if (external_id) {
      const { data: existing } = await supabase
        .from('debtors')
        .select('id')
        .eq('agency_id', agency.id)
        .eq('account_number', external_id)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Debtor with this external_id already exists' },
          { status: 409 }
        )
      }
    }

    // Create debtor
    const { data: debtor, error } = await supabase
      .from('debtors')
      .insert({
        agency_id: agency.id,
        name,
        email,
        balance_cents: Math.round(parseFloat(balance) * 100),
        state: debtorData.state,
        phone: debtorData.phone,
        address: debtorData.address,
        city: debtorData.city,
        zip: debtorData.zip,
        account_number: external_id,
        original_creditor: debtorData.original_creditor,
        notes: debtorData.notes
      })
      .select()
      .single()

    if (error) throw error

    // Auto-enroll in default workflow if specified
    if (debtorData.auto_enroll !== false) {
      const { data: defaultWorkflow } = await supabase
        .from('workflows')
        .select('id')
        .eq('agency_id', agency.id)
        .eq('is_default', true)
        .eq('is_active', true)
        .single()

      if (defaultWorkflow) {
        await supabase
          .from('debtor_workflows')
          .insert({
            debtor_id: debtor.id,
            workflow_id: defaultWorkflow.id,
            current_step_number: 1,
            status: 'active',
            next_action_at: new Date().toISOString()
          })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: debtor.id,
        external_id: debtor.account_number,
        name: debtor.name,
        email: debtor.email,
        balance: (debtor.balance_cents / 100).toFixed(2),
        created_at: debtor.created_at,
        enrolled_in_workflow: !!defaultWorkflow
      }
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create debtor' }, 
      { status: error.message.includes('Invalid') ? 401 : 500 }
    )
  }
} 