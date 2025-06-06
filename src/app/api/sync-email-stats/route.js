import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { debtorEmail, opened = false, clicked = false } = await request.json()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Find the most recent letter for this debtor
    const { data: letter, error: letterError } = await supabase
      .from('letters')
      .select(`
        id,
        status,
        opened_at,
        clicked_at,
        debtors!inner(email)
      `)
      .eq('debtors.email', debtorEmail)
      .eq('channel', 'email')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (letterError || !letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    // Update letter stats
    const updates = {}
    
    if (opened && !letter.opened_at) {
      // Don't change status - keep it as 'sent'
      updates.opened_at = new Date().toISOString()
      updates.open_count = 1
    }
    
    if (clicked && !letter.clicked_at) {
      updates.status = 'clicked'
      updates.clicked_at = new Date().toISOString()
      updates.click_count = 1
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('letters')
        .update(updates)
        .eq('id', letter.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      letterId: letter.id,
      updates,
      message: `Letter stats updated: ${opened ? 'opened' : ''} ${clicked ? 'clicked' : ''}`
    })

  } catch (error) {
    console.error('Sync stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 