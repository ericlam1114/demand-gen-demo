import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { debtorEmail } = await request.json()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Find Martin's workflow
    const { data: workflows } = await supabase
      .from('debtor_workflows')
      .select(`
        id,
        debtors!inner(email, name)
      `)
      .eq('debtors.email', debtorEmail)
      .eq('status', 'active')

    if (!workflows || workflows.length === 0) {
      return NextResponse.json({ error: 'No active workflow found' }, { status: 404 })
    }

    // Mark workflow as completed
    const { error: updateError } = await supabase
      .from('debtor_workflows')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', workflows[0].id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Workflow marked as completed',
      workflowId: workflows[0].id
    })

  } catch (error) {
    console.error('Mark workflow complete error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 