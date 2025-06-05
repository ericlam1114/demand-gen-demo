import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Get all active workflows
    const { data: workflows, error } = await supabase
      .from('debtor_workflows')
      .select(`
        id,
        current_step_number,
        status,
        next_action_at,
        created_at,
        debtors (
          name,
          email
        ),
        workflows (
          name
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check which workflows are ready to execute
    const now = new Date()
    const readyWorkflows = workflows?.filter(w => 
      new Date(w.next_action_at) <= now
    ) || []

    return NextResponse.json({
      totalActive: workflows?.length || 0,
      readyToExecute: readyWorkflows.length,
      workflows: workflows?.map(w => ({
        id: w.id,
        debtor: w.debtors?.name,
        email: w.debtors?.email,
        workflow: w.workflows?.name,
        status: w.status,
        currentStep: w.current_step_number,
        nextActionAt: w.next_action_at,
        isReady: new Date(w.next_action_at) <= now
      }))
    })

  } catch (error) {
    console.error('Check workflow status error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 