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

  if (apiKey !== `${agency.slug}_api_key_${agency.id.slice(0, 8)}`) {
    throw new Error('Invalid API key')
  }

  return agency
}

// POST /api/integration/debtors/bulk - Bulk create/update debtors
export async function POST(request) {
  try {
    const agency = await validateApiAccess(request)
    const { debtors, workflow_id, auto_enroll = true } = await request.json()
    
    if (!Array.isArray(debtors) || debtors.length === 0) {
      return NextResponse.json(
        { error: 'Debtors array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (debtors.length > 1000) {
      return NextResponse.json(
        { error: 'Maximum 1000 debtors per batch' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    const results = {
      created: [],
      updated: [],
      errors: [],
      total: debtors.length
    }

    // Get default workflow if auto_enroll is true and no workflow_id specified
    let targetWorkflowId = workflow_id
    if (auto_enroll && !workflow_id) {
      const { data: defaultWorkflow } = await supabase
        .from('workflows')
        .select('id')
        .eq('agency_id', agency.id)
        .eq('is_default', true)
        .eq('is_active', true)
        .single()
      
      targetWorkflowId = defaultWorkflow?.id
    }

    // Process each debtor
    for (const [index, debtorData] of debtors.entries()) {
      try {
        // Validate required fields
        const { name, email, balance, external_id } = debtorData
        if (!name || !email || balance === undefined) {
          results.errors.push({
            index,
            external_id,
            error: 'Name, email, and balance are required'
          })
          continue
        }

        // Check if debtor exists (by external_id or email)
        let existingDebtor = null
        if (external_id) {
          const { data } = await supabase
            .from('debtors')
            .select('id, name, email, balance_cents')
            .eq('agency_id', agency.id)
            .eq('account_number', external_id)
            .single()
          existingDebtor = data
        }

        if (!existingDebtor) {
          // Check by email as fallback
          const { data } = await supabase
            .from('debtors')
            .select('id, name, email, balance_cents')
            .eq('agency_id', agency.id)
            .eq('email', email)
            .single()
          existingDebtor = data
        }

        const debtorRecord = {
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
        }

        let debtor
        if (existingDebtor) {
          // Update existing debtor
          const { data, error } = await supabase
            .from('debtors')
            .update(debtorRecord)
            .eq('id', existingDebtor.id)
            .select()
            .single()

          if (error) throw error
          debtor = data

          results.updated.push({
            id: debtor.id,
            external_id: debtor.account_number,
            name: debtor.name,
            email: debtor.email,
            balance: (debtor.balance_cents / 100).toFixed(2),
            action: 'updated'
          })
        } else {
          // Create new debtor
          const { data, error } = await supabase
            .from('debtors')
            .insert(debtorRecord)
            .select()
            .single()

          if (error) throw error
          debtor = data

          results.created.push({
            id: debtor.id,
            external_id: debtor.account_number,
            name: debtor.name,
            email: debtor.email,
            balance: (debtor.balance_cents / 100).toFixed(2),
            action: 'created'
          })

          // Auto-enroll new debtors in workflow
          if (targetWorkflowId) {
            try {
              // Check if already enrolled
              const { data: existingEnrollment } = await supabase
                .from('debtor_workflows')
                .select('id')
                .eq('debtor_id', debtor.id)
                .eq('workflow_id', targetWorkflowId)
                .single()

              if (!existingEnrollment) {
                await supabase
                  .from('debtor_workflows')
                  .insert({
                    debtor_id: debtor.id,
                    workflow_id: targetWorkflowId,
                    current_step_number: 1,
                    status: 'active',
                    next_action_at: new Date().toISOString()
                  })
              }
            } catch (enrollError) {
              console.error('Error enrolling in workflow:', enrollError)
              // Don't fail the whole operation for enrollment errors
            }
          }
        }

      } catch (error) {
        console.error(`Error processing debtor ${index}:`, error)
        results.errors.push({
          index,
          external_id: debtorData.external_id,
          error: error.message
        })
      }
    }

    // Trigger workflow execution for new enrollments
    if (results.created.length > 0 && targetWorkflowId) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/execute-workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        console.error('Failed to trigger workflow execution:', error)
      }
    }

    const response = {
      success: true,
      results,
      summary: {
        total: results.total,
        created: results.created.length,
        updated: results.updated.length,
        errors: results.errors.length,
        workflow_enrolled: targetWorkflowId ? results.created.length : 0
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Bulk API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process bulk debtors' }, 
      { status: error.message.includes('Invalid') ? 401 : 500 }
    )
  }
} 