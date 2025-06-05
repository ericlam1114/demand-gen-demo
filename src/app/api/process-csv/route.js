import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { data, workflowId = null } = await request.json()
    
    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }

    let processed = 0
    const errors = []

    for (const record of data) {
      try {
        // Create debtor with all available fields
        const { data: debtor, error: debtorError } = await supabase
          .from('debtors')
          .insert({
            name: record.name,
            email: record.email,
            state: record.state?.toUpperCase(),
            balance_cents: record.balance_cents,
            phone: record.phone || null,
            address: record.address || null,
            city: record.city || null,
            zip: record.zip || null,
            account_number: record.account_number || null,
            original_creditor: record.original_creditor || null,
            workflow_id: workflowId // Assign specific workflow for Enterprise
          })
          .select()
          .single()

        if (debtorError) {
          errors.push(`${record.name}: ${debtorError.message}`)
          continue
        }

        // Create initial letter
        const { error: letterError } = await supabase
          .from('letters')
          .insert({
            debtor_id: debtor.id,
            status: 'draft'
          })

        if (letterError) {
          errors.push(`${record.name}: Failed to create letter`)
          continue
        }

        processed++
      } catch (error) {
        errors.push(`${record.name}: ${error.message}`)
      }
    }

    return NextResponse.json({ 
      processed, 
      errors: errors.length > 0 ? errors : null,
      message: `Successfully processed ${processed} records${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      supportedFields: {
        required: ['name', 'email', 'balance', 'state'],
        optional: ['phone', 'address', 'city', 'zip', 'account_number', 'original_creditor']
      }
    })

  } catch (error) {
    console.error('CSV processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 