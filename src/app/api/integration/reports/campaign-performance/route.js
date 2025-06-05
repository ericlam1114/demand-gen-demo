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

// GET /api/integration/reports/campaign-performance - Get detailed campaign analytics
export async function GET(request) {
  try {
    const agency = await validateApiAccess(request)
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0]
    const workflow_id = searchParams.get('workflow_id')
    const groupBy = searchParams.get('group_by') || 'day' // day, week, month
    const client_id = searchParams.get('client_id') // For portfolio-specific reports

    const supabase = createServerClient()

    // Build base query with date range
    let baseQuery = supabase
      .from('letters')
      .select(`
        id,
        status,
        sent_at,
        opened_at,
        created_at,
        debtors!inner (
          id,
          name,
          email,
          balance_cents,
          account_number,
          original_creditor,
          agency_id,
          debtor_workflows (
            workflow_id,
            workflows (
              id,
              name
            )
          )
        )
      `)
      .eq('debtors.agency_id', agency.id)
      .gte('sent_at', startDate)
      .lte('sent_at', endDate + 'T23:59:59')

    if (workflow_id) {
      baseQuery = baseQuery.eq('debtors.debtor_workflows.workflow_id', workflow_id)
    }

    if (client_id) {
      baseQuery = baseQuery.eq('debtors.original_creditor', client_id)
    }

    const { data: letters, error } = await baseQuery

    if (error) throw error

    // Calculate campaign metrics
    const totalLetters = letters.length
    const sentLetters = letters.filter(l => l.sent_at).length
    const openedLetters = letters.filter(l => l.opened_at).length
    const paidLetters = letters.filter(l => l.status === 'paid').length

    const totalBalance = letters.reduce((sum, l) => sum + (l.debtors.balance_cents || 0), 0)
    const paidBalance = letters
      .filter(l => l.status === 'paid')
      .reduce((sum, l) => sum + (l.debtors.balance_cents || 0), 0)

    // Performance by workflow
    const workflowPerformance = {}
    letters.forEach(letter => {
      const workflow = letter.debtors.debtor_workflows?.[0]?.workflows
      if (!workflow) return

      if (!workflowPerformance[workflow.id]) {
        workflowPerformance[workflow.id] = {
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          total_letters: 0,
          sent_letters: 0,
          opened_letters: 0,
          paid_letters: 0,
          total_balance: 0,
          paid_balance: 0
        }
      }

      const perf = workflowPerformance[workflow.id]
      perf.total_letters++
      if (letter.sent_at) perf.sent_letters++
      if (letter.opened_at) perf.opened_letters++
      if (letter.status === 'paid') {
        perf.paid_letters++
        perf.paid_balance += letter.debtors.balance_cents
      }
      perf.total_balance += letter.debtors.balance_cents
    })

    // Calculate rates for each workflow
    Object.values(workflowPerformance).forEach(perf => {
      perf.open_rate = perf.sent_letters > 0 ? (perf.opened_letters / perf.sent_letters * 100).toFixed(2) : 0
      perf.payment_rate = perf.sent_letters > 0 ? (perf.paid_letters / perf.sent_letters * 100).toFixed(2) : 0
      perf.collection_rate = perf.total_balance > 0 ? (perf.paid_balance / perf.total_balance * 100).toFixed(2) : 0
      perf.avg_balance = perf.total_letters > 0 ? (perf.total_balance / perf.total_letters / 100).toFixed(2) : 0
    })

    // Performance by client/creditor
    const clientPerformance = {}
    letters.forEach(letter => {
      const client = letter.debtors.original_creditor || 'Unknown'
      
      if (!clientPerformance[client]) {
        clientPerformance[client] = {
          client_name: client,
          total_letters: 0,
          sent_letters: 0,
          opened_letters: 0,
          paid_letters: 0,
          total_balance: 0,
          paid_balance: 0
        }
      }

      const perf = clientPerformance[client]
      perf.total_letters++
      if (letter.sent_at) perf.sent_letters++
      if (letter.opened_at) perf.opened_letters++
      if (letter.status === 'paid') {
        perf.paid_letters++
        perf.paid_balance += letter.debtors.balance_cents
      }
      perf.total_balance += letter.debtors.balance_cents
    })

    // Calculate rates for each client
    Object.values(clientPerformance).forEach(perf => {
      perf.open_rate = perf.sent_letters > 0 ? (perf.opened_letters / perf.sent_letters * 100).toFixed(2) : 0
      perf.payment_rate = perf.sent_letters > 0 ? (perf.paid_letters / perf.sent_letters * 100).toFixed(2) : 0
      perf.collection_rate = perf.total_balance > 0 ? (perf.paid_balance / perf.total_balance * 100).toFixed(2) : 0
    })

    // Time-based performance (groupBy day/week/month)
    const timePerformance = {}
    letters.forEach(letter => {
      if (!letter.sent_at) return

      const date = new Date(letter.sent_at)
      let timeKey
      
      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          timeKey = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        default: // day
          timeKey = date.toISOString().split('T')[0]
      }

      if (!timePerformance[timeKey]) {
        timePerformance[timeKey] = {
          period: timeKey,
          letters_sent: 0,
          letters_opened: 0,
          letters_paid: 0,
          balance_total: 0,
          balance_collected: 0
        }
      }

      const perf = timePerformance[timeKey]
      perf.letters_sent++
      if (letter.opened_at) perf.letters_opened++
      if (letter.status === 'paid') {
        perf.letters_paid++
        perf.balance_collected += letter.debtors.balance_cents
      }
      perf.balance_total += letter.debtors.balance_cents
    })

    // Sort time performance by period
    const sortedTimePerformance = Object.values(timePerformance)
      .sort((a, b) => a.period.localeCompare(b.period))

    // Calculate overall metrics
    const openRate = sentLetters > 0 ? (openedLetters / sentLetters * 100).toFixed(2) : 0
    const paymentRate = sentLetters > 0 ? (paidLetters / sentLetters * 100).toFixed(2) : 0
    const collectionRate = totalBalance > 0 ? (paidBalance / totalBalance * 100).toFixed(2) : 0

    return NextResponse.json({
      success: true,
      date_range: {
        start_date: startDate,
        end_date: endDate,
        days: Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
      },
      overall_metrics: {
        total_letters: totalLetters,
        sent_letters: sentLetters,
        opened_letters: openedLetters,
        paid_letters: paidLetters,
        open_rate: parseFloat(openRate),
        payment_rate: parseFloat(paymentRate),
        collection_rate: parseFloat(collectionRate),
        total_balance: (totalBalance / 100).toFixed(2),
        collected_balance: (paidBalance / 100).toFixed(2),
        avg_balance_per_letter: totalLetters > 0 ? (totalBalance / totalLetters / 100).toFixed(2) : 0
      },
      workflow_performance: Object.values(workflowPerformance),
      client_performance: Object.values(clientPerformance),
      time_series: sortedTimePerformance,
      complimentary_insights: {
        description: "These metrics show the incremental value of your letter campaigns",
        best_performing_workflow: Object.values(workflowPerformance)
          .sort((a, b) => parseFloat(b.collection_rate) - parseFloat(a.collection_rate))[0]?.workflow_name || 'N/A',
        recommendations: generateRecommendations(workflowPerformance, clientPerformance, openRate, paymentRate)
      }
    })

  } catch (error) {
    console.error('Campaign Performance API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate campaign performance report' }, 
      { status: error.message.includes('Invalid') ? 401 : 500 }
    )
  }
}

// Generate actionable recommendations based on performance data
function generateRecommendations(workflowPerf, clientPerf, openRate, paymentRate) {
  const recommendations = []

  // Check open rates
  if (parseFloat(openRate) < 20) {
    recommendations.push({
      type: 'open_rate',
      priority: 'high',
      message: 'Email open rate is below 20%. Consider testing different subject lines or send times.'
    })
  }

  // Check payment rates
  if (parseFloat(paymentRate) < 5) {
    recommendations.push({
      type: 'payment_rate',
      priority: 'high', 
      message: 'Payment rate is below 5%. Consider adjusting letter content or payment options.'
    })
  }

  // Workflow recommendations
  const workflowArray = Object.values(workflowPerf)
  if (workflowArray.length > 1) {
    const best = workflowArray.sort((a, b) => parseFloat(b.collection_rate) - parseFloat(a.collection_rate))[0]
    const worst = workflowArray[workflowArray.length - 1]
    
    if (parseFloat(best.collection_rate) - parseFloat(worst.collection_rate) > 10) {
      recommendations.push({
        type: 'workflow_optimization',
        priority: 'medium',
        message: `Workflow "${best.workflow_name}" is performing ${(parseFloat(best.collection_rate) - parseFloat(worst.collection_rate)).toFixed(1)}% better than "${worst.workflow_name}". Consider applying similar tactics.`
      })
    }
  }

  // Client performance recommendations
  const clientArray = Object.values(clientPerf)
  const lowPerformingClients = clientArray.filter(c => parseFloat(c.collection_rate) < 10)
  if (lowPerformingClients.length > 0) {
    recommendations.push({
      type: 'client_focus',
      priority: 'medium',
      message: `${lowPerformingClients.length} client(s) have collection rates below 10%. Consider specialized approaches for these portfolios.`
    })
  }

  return recommendations
} 