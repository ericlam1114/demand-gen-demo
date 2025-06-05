import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Process records in batches to avoid memory and timeout issues
const BATCH_SIZE = 50 // Process 50 records at a time

export async function POST(request) {
  try {
    const { data, workflowId = null, agencyId } = await request.json()
    
    console.log('[CSV Processing] Starting with data:', {
      recordCount: data?.length || 0,
      workflowId,
      agencyId,
      batchSize: BATCH_SIZE,
      sampleRecord: data?.[0] // Add sample record for debugging
    })
    
    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }

    if (!agencyId) {
      return NextResponse.json({ error: 'Agency ID is required' }, { status: 400 })
    }

    if (data.length > 2000) {
      return NextResponse.json({ 
        error: 'Maximum 2000 records per upload. Please split your file into smaller batches.' 
      }, { status: 400 })
    }

    // Use server client for database operations
    const supabase = createServerClient()
    let totalProcessed = 0
    const allErrors = []

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

    // Process records in batches to avoid memory issues and timeouts
    const totalBatches = Math.ceil(data.length / BATCH_SIZE)
    console.log(`[CSV Processing] Processing ${data.length} records in ${totalBatches} batches of ${BATCH_SIZE}`)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE
      const endIdx = Math.min(startIdx + BATCH_SIZE, data.length)
      const batch = data.slice(startIdx, endIdx)
      
      console.log(`[CSV Processing] Processing batch ${batchIndex + 1}/${totalBatches} (records ${startIdx + 1}-${endIdx})`)
      
      // Process this batch
      const batchResults = await processBatch(supabase, batch, agencyId, targetWorkflowId, workflow.name)
      
      totalProcessed += batchResults.processed
      allErrors.push(...batchResults.errors)
      
      // Clear batch from memory
      batch.length = 0
      
      console.log(`[CSV Processing] Batch ${batchIndex + 1} complete. Processed: ${batchResults.processed}, Errors: ${batchResults.errors.length}`)
    }

    // Trigger workflow execution for all new enrollments (but don't wait for it)
    if (totalProcessed > 0) {
      console.log('[CSV Processing] Triggering workflow execution for', totalProcessed, 'new debtors')
      // Don't await this - let it run in background
      triggerWorkflowExecution(agencyId, targetWorkflowId).catch(error => {
        console.warn('[CSV Processing] Background workflow execution failed:', error)
      })
    }

    console.log('[CSV Processing] Completed:', { processed: totalProcessed, errorCount: allErrors.length })

    return NextResponse.json({ 
      processed: totalProcessed, 
      errors: allErrors.length > 0 ? allErrors : null,
      message: `Successfully processed ${totalProcessed} records and started ${workflow.name} workflow${allErrors.length > 0 ? ` with ${allErrors.length} errors` : ''}. Letters will be sent automatically.`,
      workflow_started: {
        workflow_id: targetWorkflowId,
        workflow_name: workflow.name,
        debtors_enrolled: totalProcessed
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

// Process a batch of records efficiently
async function processBatch(supabase, batch, agencyId, targetWorkflowId, workflowName) {
  const results = { processed: 0, errors: [] }
  
  // Prepare bulk insert arrays
  const debtors = []
  const letters = []
  const workflows = []
  const events = []
  const now = new Date().toISOString()
  
  // Validate and prepare all records first
  for (const [index, record] of batch.entries()) {
    try {
      // Validate required fields (using original field names from CSV)
      if (!record.name || !record.email || !record.balance || !record.state) {
        results.errors.push(`Record ${index + 1}: Missing required fields (name, email, balance, state)`)
        continue
      }
      
      // Convert balance to cents (like original code)
      const balanceCents = Math.round(parseFloat(record.balance) * 100)
      if (isNaN(balanceCents)) {
        results.errors.push(`Record ${index + 1} (${record.name}): Invalid balance amount`)
          continue
        }

      // Generate UUIDs for relationships
      const debtorId = crypto.randomUUID()
      const letterId = crypto.randomUUID()
      
      // Prepare debtor record
      debtors.push({
        id: debtorId,
        agency_id: agencyId,
        name: record.name,
        email: record.email,
        state: record.state?.toUpperCase(),
        balance_cents: balanceCents,
        phone: record.phone || null,
        address: record.address || null,
        city: record.city || null,
        zip: record.zip || null,
        account_number: record.account_number || null,
        original_creditor: record.original_creditor || null,
        created_at: now
      })
      
      // Prepare letter record
      letters.push({
        id: letterId,
        debtor_id: debtorId,
        status: 'sent',
        sent_at: now,
        created_at: now
      })
      
      // Prepare workflow enrollment
      workflows.push({
        debtor_id: debtorId,
            workflow_id: targetWorkflowId,
            current_step_number: 1,
            status: 'active',
        started_at: now,
        next_action_at: now,
        created_at: now
      })
      
      // Prepare audit event
      events.push({
        letter_id: letterId,
        type: 'sent',
        recorded_at: now,
        metadata: {
          source: 'csv_upload',
          workflow_id: targetWorkflowId,
          workflow_name: workflowName,
          step_number: 1,
          debtor_name: record.name
        },
        created_at: now
      })
      
    } catch (error) {
      results.errors.push(`Record ${index + 1} (${record.name || 'Unknown'}): ${error.message}`)
    }
  }
  
  // Bulk insert all records (much faster than individual inserts)
  try {
    if (debtors.length > 0) {
      console.log(`[CSV Processing] Bulk inserting ${debtors.length} records...`)
      
      // Insert debtors
      const { error: debtorsError } = await supabase
        .from('debtors')
        .insert(debtors)
      
      if (debtorsError) throw new Error(`Debtors insert: ${debtorsError.message}`)
      
      // Insert letters
      const { error: lettersError } = await supabase
        .from('letters')
        .insert(letters)
      
      if (lettersError) throw new Error(`Letters insert: ${lettersError.message}`)
      
      // Insert workflow enrollments
      const { error: workflowsError } = await supabase
        .from('debtor_workflows')
        .insert(workflows)
      
      if (workflowsError) throw new Error(`Workflows insert: ${workflowsError.message}`)
      
      // Insert audit events (non-critical, don't fail if this errors)
      try {
        await supabase
          .from('events')
          .insert(events)
      } catch (eventsError) {
        console.warn('[CSV Processing] Failed to create audit events:', eventsError)
      }
      
      results.processed = debtors.length
      console.log(`[CSV Processing] Successfully bulk inserted ${debtors.length} complete records`)
    }
    
  } catch (error) {
    console.error('[CSV Processing] Bulk insert failed:', error)
    results.errors.push(`Bulk insert failed: ${error.message}`)
      }
  
  return results
    }

// Trigger workflow execution in background (non-blocking)
async function triggerWorkflowExecution(agencyId, workflowId) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/execute-workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        agency_id: agencyId,
        workflow_id: workflowId,
        immediate: true
      })
    })

    if (!response.ok) {
      console.warn('[CSV Processing] Failed to trigger workflow execution:', await response.text())
    } else {
      console.log('[CSV Processing] Workflow execution triggered successfully')
    }
  } catch (executeError) {
    console.warn('[CSV Processing] Error triggering workflow execution:', executeError)
  }
} 