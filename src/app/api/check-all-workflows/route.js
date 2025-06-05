import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Get all workflows with their steps
    const { data: workflows, error } = await supabase
      .from('workflows')
      .select(`
        id,
        name,
        workflow_steps (
          step_number,
          step_type,
          template_id
        )
      `)
      .order('name')

    if (error) {
      console.error('Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get active debtor workflows
    const { data: activeWorkflows, error: activeError } = await supabase
      .from('debtor_workflows')
      .select(`
        id,
        workflow_id,
        current_step_number,
        status,
        next_action_at,
        debtors (name, email)
      `)
      .eq('status', 'active')
      .lte('next_action_at', new Date().toISOString())

    if (activeError) {
      console.error('Active workflows error:', activeError)
    }

    return NextResponse.json({
      workflows: workflows || [],
      activeWorkflows: activeWorkflows || [],
      summary: {
        totalWorkflows: workflows?.length || 0,
        workflowsWithPhysicalMail: workflows?.filter(w => 
          w.workflow_steps?.some(s => s.step_type === 'physical')
        ).length || 0,
        activeWorkflowsReady: activeWorkflows?.length || 0
      }
    })

  } catch (error) {
    console.error('Check workflows error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 