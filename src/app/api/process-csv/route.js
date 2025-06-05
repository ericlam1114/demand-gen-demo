import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { data, workflowId = null, agencyId } = await request.json()
    
    console.log('[CSV Processing] Starting with data:', {
      recordCount: data?.length || 0,
      workflowId,
      agencyId,
      sampleRecord: data?.[0]
    })
    
    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }

    if (!agencyId) {
      return NextResponse.json({ error: 'Agency ID is required' }, { status: 400 })
    }

    // Use server client for database operations
    const supabase = createServerClient()
    let processed = 0
    const errors = []

    console.log('[CSV Processing] Using agency ID:', agencyId)

    // Get the workflow to use (either specified or default)
    let targetWorkflowId = workflowId
    if (!targetWorkflowId) {
      console.log('[CSV Processing] No workflow specified, looking for default workflow...')
      const { data: defaultWorkflows, error: workflowError } = await supabase
        .from('workflows')
        .select('id, name')
        .eq('agency_id', agencyId)
        .eq('is_default', true)
        .eq('is_active', true)
        .limit(1)
      
      if (workflowError) {
        console.error('[CSV Processing] Error finding default workflow:', workflowError)
      } else if (defaultWorkflows && defaultWorkflows.length > 0) {
        const defaultWorkflow = defaultWorkflows[0]
        targetWorkflowId = defaultWorkflow.id
        console.log('[CSV Processing] Using default workflow:', defaultWorkflow.name, defaultWorkflow.id)
      }
    }

    if (!targetWorkflowId) {
      return NextResponse.json({ 
        error: 'No workflow specified and no default workflow found. Please create a default workflow first.' 
      }, { status: 400 })
    }

    // Get workflow details for letter generation
    const { data: workflow, error: workflowFetchError } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('id', targetWorkflowId)
      .single()

    if (workflowFetchError || !workflow) {
      return NextResponse.json({ 
        error: 'Failed to fetch workflow details' 
      }, { status: 400 })
    }

    // Fetch the first step from workflow_steps table
    const { data: firstStep, error: stepError } = await supabase
      .from('workflow_steps')
      .select('step_number, step_type')
      .eq('workflow_id', targetWorkflowId)
      .order('step_number', { ascending: true })
      .limit(1)
      .single()

    if (stepError || !firstStep) {
      return NextResponse.json({ 
        error: 'Workflow has no steps configured' 
      }, { status: 400 })
    }

    if (!['send_letter', 'email'].includes(firstStep.step_type)) {
      return NextResponse.json({ 
        error: 'Workflow first step must be email or send_letter type' 
      }, { status: 400 })
    }

    for (const record of data) {
      try {
        console.log('[CSV Processing] Processing record:', record.name)
        
        // Create debtor with all available fields
        const { data: debtor, error: debtorError } = await supabase
          .from('debtors')
          .insert({
            agency_id: agencyId,
            name: record.name,
            email: record.email,
            state: record.state?.toUpperCase(),
            balance_cents: record.balance_cents,
            phone: record.phone || null,
            address: record.address || null,
            city: record.city || null,
            zip: record.zip || null,
            account_number: record.account_number || null,
            original_creditor: record.original_creditor || null
          })
          .select()
          .single()

        if (debtorError) {
          console.error('[CSV Processing] Debtor creation error:', debtorError)
          errors.push(`${record.name}: ${debtorError.message}`)
          continue
        }

        console.log('[CSV Processing] Created debtor:', debtor.id)

        // Create letter with 'sent' status (not draft)
        const { data: letter, error: letterError } = await supabase
          .from('letters')
          .insert({
            debtor_id: debtor.id,
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .select()
          .single()

        if (letterError) {
          console.error('[CSV Processing] Letter creation error:', letterError)
          errors.push(`${record.name}: Failed to create letter - ${letterError.message}`)
          continue
        }

        console.log('[CSV Processing] Created letter:', letter.id)

        // Enroll debtor in workflow
        const { error: workflowError } = await supabase
          .from('debtor_workflows')
          .insert({
            debtor_id: debtor.id,
            workflow_id: targetWorkflowId,
            current_step_number: 1,
            status: 'active',
            started_at: new Date().toISOString(),
            next_action_at: new Date().toISOString()
          })

        if (workflowError) {
          console.error('[CSV Processing] Workflow enrollment error:', workflowError)
          errors.push(`${record.name}: Failed to enroll in workflow - ${workflowError.message}`)
          continue
        }

        console.log('[CSV Processing] Enrolled in workflow:', targetWorkflowId)

        // Create audit event for immediate letter sending
        try {
          await supabase
            .from('events')
            .insert({
              letter_id: letter.id,
              type: 'sent',
              recorded_at: new Date().toISOString(),
              metadata: {
                source: 'csv_upload',
                workflow_id: targetWorkflowId,
                workflow_name: workflow.name,
                step_number: 1,
                debtor_name: record.name
              }
            })
        } catch (eventError) {
          console.warn('[CSV Processing] Failed to create audit event:', eventError)
          // Don't fail the whole process for audit events
        }

        processed++
        console.log('[CSV Processing] Successfully processed:', record.name)
      } catch (error) {
        console.error('[CSV Processing] Unexpected error for', record.name, ':', error)
        errors.push(`${record.name}: ${error.message}`)
      }
    }

    // Trigger immediate workflow execution for all new enrollments
    if (processed > 0) {
      console.log('[CSV Processing] Triggering workflow execution for', processed, 'new debtors')
      try {
        const executeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/execute-workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            agency_id: agencyId,
            workflow_id: targetWorkflowId,
            immediate: true
          })
        })
        
        if (!executeResponse.ok) {
          console.warn('[CSV Processing] Failed to trigger workflow execution:', await executeResponse.text())
        } else {
          console.log('[CSV Processing] Workflow execution triggered successfully')
        }
      } catch (executeError) {
        console.warn('[CSV Processing] Error triggering workflow execution:', executeError)
      }
    }

    console.log('[CSV Processing] Completed:', { processed, errorCount: errors.length })

    return NextResponse.json({ 
      processed, 
      errors: errors.length > 0 ? errors : null,
      message: `Successfully processed ${processed} records and started ${workflow.name} workflow${errors.length > 0 ? ` with ${errors.length} errors` : ''}. Letters have been sent automatically.`,
      workflow_started: {
        workflow_id: targetWorkflowId,
        workflow_name: workflow.name,
        debtors_enrolled: processed
      },
      supportedFields: {
        required: ['name', 'email', 'balance', 'state'],
        optional: ['phone', 'address', 'city', 'zip', 'account_number', 'original_creditor']
      }
    })

  } catch (error) {
    console.error('[CSV Processing] Fatal error:', error)
    return NextResponse.json({ 
      error: 'Internal server error: ' + error.message 
    }, { status: 500 })
  }
} 