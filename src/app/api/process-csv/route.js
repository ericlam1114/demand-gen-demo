import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request) {
  try {
    const { data: csvData, workflowId } = await request.json()
    
    if (!csvData || !Array.isArray(csvData)) {
      return NextResponse.json(
        { error: 'Invalid CSV data' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    let processed = 0
    let errors = []

    // Get default workflow if none specified
    let targetWorkflowId = workflowId
    if (!targetWorkflowId) {
      const { data: defaultWorkflow, error: workflowError } = await supabase
        .from('workflows')
        .select('id')
        .eq('is_default', true)
        .eq('is_active', true)
        .single()

      if (workflowError || !defaultWorkflow) {
        return NextResponse.json(
          { error: 'No default workflow found. Please create a workflow first.' },
          { status: 400 }
        )
      }
      targetWorkflowId = defaultWorkflow.id
    }

    // Process each debtor
    for (const row of csvData) {
      try {
        // Required fields
        if (!row.name || !row.email || !row.balance) {
          errors.push(`Missing required fields for ${row.name || 'unknown'}: name, email, and balance are required`)
          continue
        }

        // Convert balance to cents
        const balanceCents = Math.round(parseFloat(row.balance) * 100)
        
        // Prepare debtor data with all available fields
        const debtorData = {
          name: row.name,
          email: row.email,
          balance_cents: balanceCents,
          state: row.state || null,
          phone: row.phone || null,
          address: row.address || null,
          city: row.city || null,
          zip: row.zip || row.zipcode || row.postal_code || null,
          country: row.country || 'US',
          account_number: row.account_number || row.account || row.acct_number || null,
          original_creditor: row.original_creditor || row.creditor || row.client || null,
          notes: row.notes || row.memo || row.description || null,
          agency_id: null // Will be set properly with auth
        }
        
        // Insert debtor
        const { data: debtor, error: debtorError } = await supabase
          .from('debtors')
          .insert(debtorData)
          .select()
          .single()

        if (debtorError) {
          errors.push(`Failed to insert debtor ${row.name}: ${debtorError.message}`)
          continue
        }

        // Assign debtor to workflow
        const { error: assignmentError } = await supabase
          .from('debtor_workflows')
          .insert({
            debtor_id: debtor.id,
            workflow_id: targetWorkflowId,
            current_step_number: 1,
            status: 'active',
            next_action_at: new Date().toISOString() // Execute first step immediately
          })

        if (assignmentError) {
          errors.push(`Failed to assign ${row.name} to workflow: ${assignmentError.message}`)
          continue
        }

        processed++
      } catch (error) {
        console.error(`Error processing row for ${row.name}:`, error)
        errors.push(`Failed to process ${row.name}: ${error.message}`)
      }
    }

    // Trigger workflow execution for immediate steps
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/execute-workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(error => {
      console.error('Failed to trigger workflow execution:', error)
    })

    return NextResponse.json({
      success: true,
      processed,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully assigned ${processed} debtors to workflow. ${processed} will receive their first demand letter immediately.`,
      supportedFields: {
        required: ['name', 'email', 'balance'],
        optional: ['state', 'phone', 'address', 'city', 'zip/zipcode/postal_code', 'country', 'account_number/account/acct_number', 'original_creditor/creditor/client', 'notes/memo/description']
      }
    })

  } catch (error) {
    console.error('CSV processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 