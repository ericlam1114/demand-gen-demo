import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Get Martin's workflow
    const { data: workflows, error: workflowError } = await supabase
      .from('debtor_workflows')
      .select(`
        *,
        debtors (name, email),
        workflows (id, name)
      `)
    
    const workflow = workflows?.find(w => 
      w.debtors?.email === 'ericlam1114@gmail.com' && 
      w.debtors?.name === 'Martin Goldsled'
    )

    if (workflowError) {
      console.error('Workflow query error:', workflowError)
    }

    // Get workflow steps
    const workflowId = workflow?.workflow_id
    const { data: steps, error: stepsError } = await supabase
      .from('workflow_steps')
      .select(`
        *,
        templates (
          id,
          name,
          channel,
          email_subject,
          html_content
        )
      `)
      .eq('workflow_id', workflowId)
      .order('step_number')

    if (stepsError) {
      console.error('Steps query error:', stepsError)
    }

    return NextResponse.json({
      workflow: {
        id: workflow?.id,
        workflowId: workflow?.workflow_id,
        currentStep: workflow?.current_step_number,
        status: workflow?.status,
        nextActionAt: workflow?.next_action_at,
        debtor: workflow?.debtors,
        workflowName: workflow?.workflows?.name
      },
      steps: steps || [],
      stepsCount: steps?.length || 0,
      currentStepDetails: steps?.find(s => s.step_number === workflow?.current_step_number)
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 