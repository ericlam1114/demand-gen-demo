import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Helper function to validate agency API access
async function validateApiAccess(request) {
  const authHeader = request.headers.get('Authorization')
  const agencySlug = request.headers.get('X-Agency-Slug')
  
  if (!authHeader || !agencySlug) {
    throw new Error('Missing authorization or agency slug')
  }

  const apiKey = authHeader.replace('Bearer ', '')
  const supabase = createServerClient()
  
  const { data: agency, error } = await supabase
    .from('agencies')
    .select('id, name, slug')
    .eq('slug', agencySlug)
    .eq('is_active', true)
    .single()

  if (error || !agency) {
    throw new Error('Invalid agency')
  }

  if (apiKey !== `${agency.slug}_api_key_${agency.id.slice(0, 8)}`) {
    throw new Error('Invalid API key')
  }

  return agency
}

// GET /api/integration/export - Export data for external systems
export async function GET(request) {
  try {
    const agency = await validateApiAccess(request)
    const { searchParams } = new URL(request.url)
    
    const exportType = searchParams.get('type') || 'debtors' // debtors, letters, campaigns, all
    const format = searchParams.get('format') || 'json' // json, csv
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const status = searchParams.get('status')
    const workflow_id = searchParams.get('workflow_id')

    const supabase = createServerClient()
    let exportData = {}

    // Export debtors
    if (exportType === 'debtors' || exportType === 'all') {
      let debtorQuery = supabase
        .from('debtors')
        .select(`
          id,
          name,
          email,
          phone,
          address,
          city,
          state,
          zip,
          balance_cents,
          account_number,
          original_creditor,
          notes,
          created_at,
          updated_at,
          debtor_workflows!left (
            id,
            workflow_id,
            status,
            current_step_number,
            next_action_at,
            started_at,
            completed_at,
            workflows (
              name,
              description
            )
          )
        `)
        .eq('agency_id', agency.id)

      if (startDate) {
        debtorQuery = debtorQuery.gte('created_at', startDate)
      }
      if (endDate) {
        debtorQuery = debtorQuery.lte('created_at', endDate + 'T23:59:59')
      }
      if (status) {
        debtorQuery = debtorQuery.eq('debtor_workflows.status', status)
      }
      if (workflow_id) {
        debtorQuery = debtorQuery.eq('debtor_workflows.workflow_id', workflow_id)
      }

      const { data: debtors, error: debtorError } = await debtorQuery
      if (debtorError) throw debtorError

      // Format debtors for export
      exportData.debtors = debtors.map(debtor => ({
        external_id: debtor.account_number,
        name: debtor.name,
        email: debtor.email,
        phone: debtor.phone,
        address: debtor.address,
        city: debtor.city,
        state: debtor.state,
        zip: debtor.zip,
        balance: (debtor.balance_cents / 100).toFixed(2),
        original_creditor: debtor.original_creditor,
        notes: debtor.notes,
        created_at: debtor.created_at,
        campaign_status: debtor.debtor_workflows?.[0]?.status || 'not_enrolled',
        current_step: debtor.debtor_workflows?.[0]?.current_step_number || 0,
        workflow_name: debtor.debtor_workflows?.[0]?.workflows?.name,
        next_action_at: debtor.debtor_workflows?.[0]?.next_action_at,
        campaign_started: debtor.debtor_workflows?.[0]?.started_at,
        campaign_completed: debtor.debtor_workflows?.[0]?.completed_at
      }))
    }

    // Export letters
    if (exportType === 'letters' || exportType === 'all') {
      let letterQuery = supabase
        .from('letters')
        .select(`
          id,
          status,
          sent_at,
          opened_at,
          clicked_at,
          bounced_at,
          bounce_reason,
          created_at,
          debtors!inner (
            id,
            name,
            email,
            account_number,
            balance_cents,
            original_creditor
          ),
          workflow_steps (
            step_number,
            workflows (
              name
            )
          ),
          templates (
            name,
            subject
          )
        `)
        .eq('debtors.agency_id', agency.id)

      if (startDate) {
        letterQuery = letterQuery.gte('sent_at', startDate)
      }
      if (endDate) {
        letterQuery = letterQuery.lte('sent_at', endDate + 'T23:59:59')
      }
      if (status) {
        letterQuery = letterQuery.eq('status', status)
      }

      const { data: letters, error: letterError } = await letterQuery
      if (letterError) throw letterError

      exportData.letters = letters.map(letter => ({
        letter_id: letter.id,
        external_id: letter.debtors.account_number,
        debtor_name: letter.debtors.name,
        debtor_email: letter.debtors.email,
        balance: (letter.debtors.balance_cents / 100).toFixed(2),
        original_creditor: letter.debtors.original_creditor,
        template_name: letter.templates?.name,
        subject: letter.templates?.subject,
        workflow_name: letter.workflow_steps?.workflows?.name,
        step_number: letter.workflow_steps?.step_number,
        status: letter.status,
        sent_at: letter.sent_at,
        opened_at: letter.opened_at,
        clicked_at: letter.clicked_at,
        bounced_at: letter.bounced_at,
        bounce_reason: letter.bounce_reason,
        created_at: letter.created_at
      }))
    }

    // Export campaign statistics
    if (exportType === 'campaigns' || exportType === 'all') {
      const { data: workflows, error: workflowError } = await supabase
        .from('workflows')
        .select(`
          id,
          name,
          description,
          is_active,
          created_at,
          debtor_workflows (
            id,
            status,
            started_at,
            completed_at,
            debtors (
              balance_cents,
              account_number
            )
          )
        `)
        .eq('agency_id', agency.id)

      if (workflowError) throw workflowError

      exportData.campaigns = workflows.map(workflow => {
        const enrollments = workflow.debtor_workflows || []
        const activeEnrollments = enrollments.filter(e => e.status === 'active')
        const completedEnrollments = enrollments.filter(e => e.status === 'completed')
        const paidEnrollments = enrollments.filter(e => e.status === 'paid')

        const totalBalance = enrollments.reduce((sum, e) => sum + (e.debtors?.balance_cents || 0), 0)
        const paidBalance = paidEnrollments.reduce((sum, e) => sum + (e.debtors?.balance_cents || 0), 0)

        return {
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          description: workflow.description,
          is_active: workflow.is_active,
          created_at: workflow.created_at,
          total_enrollments: enrollments.length,
          active_enrollments: activeEnrollments.length,
          completed_enrollments: completedEnrollments.length,
          paid_enrollments: paidEnrollments.length,
          total_balance: (totalBalance / 100).toFixed(2),
          collected_balance: (paidBalance / 100).toFixed(2),
          collection_rate: totalBalance > 0 ? (paidBalance / totalBalance * 100).toFixed(2) : 0,
          payment_rate: enrollments.length > 0 ? (paidEnrollments.length / enrollments.length * 100).toFixed(2) : 0
        }
      })
    }

    // Handle CSV format export
    if (format === 'csv') {
      let csvContent = ''
      
      if (exportType === 'debtors' && exportData.debtors) {
        csvContent = convertToCSV(exportData.debtors)
      } else if (exportType === 'letters' && exportData.letters) {
        csvContent = convertToCSV(exportData.letters)
      } else if (exportType === 'campaigns' && exportData.campaigns) {
        csvContent = convertToCSV(exportData.campaigns)
      } else {
        // For 'all' type, create separate CSV sections
        const sections = []
        if (exportData.debtors) sections.push('=== DEBTORS ===\n' + convertToCSV(exportData.debtors))
        if (exportData.letters) sections.push('=== LETTERS ===\n' + convertToCSV(exportData.letters))
        if (exportData.campaigns) sections.push('=== CAMPAIGNS ===\n' + convertToCSV(exportData.campaigns))
        csvContent = sections.join('\n\n')
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${agency.slug}_${exportType}_${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // JSON format response
    return NextResponse.json({
      success: true,
      export_info: {
        agency: agency.name,
        type: exportType,
        format: format,
        generated_at: new Date().toISOString(),
        filters: {
          start_date: startDate,
          end_date: endDate,
          status: status,
          workflow_id: workflow_id
        }
      },
      data: exportData,
      summary: {
        debtors_count: exportData.debtors?.length || 0,
        letters_count: exportData.letters?.length || 0,
        campaigns_count: exportData.campaigns?.length || 0
      }
    })

  } catch (error) {
    console.error('Export API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export data' }, 
      { status: error.message.includes('Invalid') ? 401 : 500 }
    )
  }
}

// Helper function to convert JSON to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return ''

  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','), // header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Escape values that contain commas or quotes
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    )
  ]

  return csvRows.join('\n')
} 