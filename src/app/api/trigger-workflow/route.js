import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { debtorEmail } = await request.json()
    const supabase = createServerClient()
    
    // Find the debtor and their workflow
    const { data: debtor, error: debtorError } = await supabase
      .from('debtors')
      .select(`
        id,
        name,
        email,
        debtor_workflows (
          id,
          workflow_id,
          current_step_number,
          status,
          next_action_at
        )
      `)
      .eq('email', debtorEmail)
      .single()

    if (debtorError || !debtor) {
      return NextResponse.json({ error: 'Debtor not found' }, { status: 404 })
    }

    if (!debtor.debtor_workflows || debtor.debtor_workflows.length === 0) {
      return NextResponse.json({ error: 'No workflows found for debtor' }, { status: 404 })
    }

    const workflow = debtor.debtor_workflows[0]
    
    // Update the workflow to run immediately
    const { error: updateError } = await supabase
      .from('debtor_workflows')
      .update({
        next_action_at: new Date().toISOString(),
        status: 'active'
      })
      .eq('id', workflow.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 })
    }

    // Now trigger workflow execution
    const executeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/execute-workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const executeResult = await executeResponse.json()

    return NextResponse.json({
      success: true,
      debtor: debtor.name,
      email: debtor.email,
      workflowId: workflow.id,
      executionResult: executeResult
    })

  } catch (error) {
    console.error('Trigger workflow error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 