import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Search for the problematic workflow
    const workflowId = 'e8912a06-3c95-4e0b-b18c-d983d7336fad'
    
    // Check debtor_workflows table
    const { data: debtorWorkflow, error: dwError } = await supabase
      .from('debtor_workflows')
      .select(`
        *,
        debtors (name, email),
        workflows (name)
      `)
      .eq('id', workflowId)
      .single()

    if (dwError) {
      console.log('Not found in debtor_workflows')
    }

    // Check workflows table
    const { data: workflow, error: wError } = await supabase
      .from('workflows')
      .select(`
        *,
        workflow_steps (*)
      `)
      .eq('id', workflowId)
      .single()

    if (wError) {
      console.log('Not found in workflows')
    }

    // Get all debtor workflows with errors
    const { data: errorWorkflows } = await supabase
      .from('debtor_workflows')
      .select(`
        id,
        workflow_id,
        status,
        metadata,
        debtors (name, email)
      `)
      .or('status.eq.error,status.eq.failed')

    return NextResponse.json({
      searchedId: workflowId,
      foundInDebtorWorkflows: !!debtorWorkflow,
      foundInWorkflows: !!workflow,
      debtorWorkflow,
      workflow,
      errorWorkflows: errorWorkflows || []
    })

  } catch (error) {
    console.error('Find workflow error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 