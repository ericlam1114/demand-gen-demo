'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { 
  GitBranch, 
  Upload, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  Eye,
  DollarSign,
  FileText,
  ArrowRight,
  BarChart3,
  Database,
  Zap,
  Filter,
  Target,
  Package,
  Search,
  X,
  ChevronRight,
  Workflow,
  Activity,
  Send,
  Calendar,
  CalendarCheck,
  CalendarX,
  CalendarCheck2,
  CalendarX2,
  CalendarCheck3,
  CalendarX3,
} from 'lucide-react'
import toast from 'react-hot-toast'

function VisualizerContent() {
  const { profile, agency } = useAuth()
  const [loading, setLoading] = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)
  const [expandedMetrics, setExpandedMetrics] = useState({
    coverage: true,
    workflowA: true,
    workflowB: true,
    objectives: true
  })
  const [flowData, setFlowData] = useState({
    uploaded: { count: 0, value: 0 },
    inWorkflow: { count: 0, value: 0, byStep: [] },
    completed: { count: 0, value: 0 },
    paid: { count: 0, value: 0 },
    escalated: { count: 0, value: 0 },
    workflows: [],
    nodes: {
      dataCollection: { total: 0, processed: 0, pending: 0, failed: 0 },
      triggerAutomation: { total: 0, processed: 0, pending: 0, failed: 0 },
      dataValidation: { total: 0, processed: 0, pending: 0, failed: 0 },
      actionTrigger: { total: 0, processed: 0, pending: 0, failed: 0 },
      outputGeneration: { total: 0, processed: 0, pending: 0, failed: 0 }
    }
  })
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [expandedWorkflow, setExpandedWorkflow] = useState(null)

  // Fetch and calculate flow data
  const fetchFlowData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all data in parallel
      const [
        { data: debtors },
        { data: letters },
        { data: workflows },
        { data: enrollments },
        { data: workflowSteps },
        { data: executions }
      ] = await Promise.all([
        supabase.from('debtors').select('id, balance_cents, created_at'),
        supabase.from('letters').select('id, debtor_id, status, sent_at, opened_at, open_count'),
        supabase.from('workflows').select('id, name, is_active, is_default'),
        supabase.from('debtor_workflows').select(`
          id,
          debtor_id,
          workflow_id,
          status,
          current_step_order,
          enrolled_at,
          completed_at,
          workflows (name)
        `),
        supabase.from('workflow_steps').select('workflow_id, step_order, name, step_type'),
        supabase.from('workflow_executions').select('id, status, step_id')
      ])

      // Process the data
      const totalDebtors = debtors?.length || 0
      const totalValue = debtors?.reduce((sum, d) => sum + (d.balance_cents || 0), 0) || 0

      // Group enrollments by workflow
      const workflowGroups = {}
      enrollments?.forEach(enrollment => {
        const workflowId = enrollment.workflow_id
        if (!workflowGroups[workflowId]) {
          workflowGroups[workflowId] = {
            id: workflowId,
            name: enrollment.workflows?.name || 'Unknown Workflow',
            active: 0,
            completed: 0,
            steps: {},
            enrollments: []
          }
        }
        
        workflowGroups[workflowId].enrollments.push(enrollment)
        
        if (enrollment.status === 'active') {
          workflowGroups[workflowId].active++
          const stepOrder = enrollment.current_step_order || 1
          workflowGroups[workflowId].steps[stepOrder] = (workflowGroups[workflowId].steps[stepOrder] || 0) + 1
        } else if (enrollment.status === 'completed') {
          workflowGroups[workflowId].completed++
        }
      })

      // Calculate metrics
      const inWorkflowCount = enrollments?.filter(e => e.status === 'active').length || 0
      const completedCount = enrollments?.filter(e => e.status === 'completed').length || 0
      const paidCount = letters?.filter(l => l.status === 'paid').length || 0
      const escalatedCount = letters?.filter(l => l.status === 'escalated').length || 0

      // Calculate values
      const getDebtorValue = (debtorId) => {
        return debtors?.find(d => d.id === debtorId)?.balance_cents || 0
      }

      const inWorkflowValue = enrollments
        ?.filter(e => e.status === 'active')
        .reduce((sum, e) => sum + getDebtorValue(e.debtor_id), 0) || 0

      const completedValue = enrollments
        ?.filter(e => e.status === 'completed')
        .reduce((sum, e) => sum + getDebtorValue(e.debtor_id), 0) || 0

      const paidValue = letters
        ?.filter(l => l.status === 'paid')
        .reduce((sum, l) => sum + getDebtorValue(l.debtor_id), 0) || 0

      const escalatedValue = letters
        ?.filter(l => l.status === 'escalated')
        .reduce((sum, l) => sum + getDebtorValue(l.debtor_id), 0) || 0

      // Add step information to workflows
      const workflowsWithSteps = Object.values(workflowGroups).map(workflow => {
        const steps = workflowSteps?.filter(s => s.workflow_id === workflow.id) || []
        const stepDetails = steps.map(step => ({
          order: step.step_order,
          name: step.name,
          type: step.step_type,
          count: workflow.steps[step.step_order] || 0
        })).sort((a, b) => a.order - b.order)

        return {
          ...workflow,
          stepDetails,
          isDefault: workflows?.find(w => w.id === workflow.id)?.is_default || false
        }
      })

      // Email engagement metrics
      const sentCount = letters?.filter(l => l.sent_at).length || 0
      const openedCount = letters?.filter(l => l.opened_at).length || 0
      const openRate = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0

      // Calculate node metrics
      const nodes = {
        dataCollection: { 
          total: totalDebtors, 
          processed: enrollments?.length || 0, 
          pending: totalDebtors - (enrollments?.length || 0), 
          failed: 0 
        },
        triggerAutomation: { 
          total: enrollments?.length || 0, 
          processed: letters?.length || 0, 
          pending: (enrollments?.length || 0) - (letters?.length || 0), 
          failed: 0 
        },
        dataValidation: { 
          total: letters?.length || 0, 
          processed: sentCount, 
          pending: (letters?.length || 0) - sentCount, 
          failed: 0 
        },
        actionTrigger: { 
          total: sentCount, 
          processed: openedCount, 
          pending: sentCount - openedCount, 
          failed: escalatedCount 
        },
        outputGeneration: { 
          total: openedCount, 
          processed: paidCount, 
          pending: openedCount - paidCount - escalatedCount, 
          failed: 0 
        }
      }

      setFlowData({
        uploaded: { count: totalDebtors, value: totalValue },
        inWorkflow: { count: inWorkflowCount, value: inWorkflowValue },
        completed: { count: completedCount, value: completedValue },
        paid: { count: paidCount, value: paidValue },
        escalated: { count: escalatedCount, value: escalatedValue },
        workflows: workflowsWithSteps,
        emailMetrics: {
          sent: sentCount,
          opened: openedCount,
          openRate
        },
        nodes
      })

      // Select first workflow by default
      if (workflowsWithSteps.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(workflowsWithSteps[0])
      }

    } catch (error) {
      console.error('Error fetching flow data:', error)
      toast.error('Failed to load visualizer data')
    } finally {
      setLoading(false)
    }
  }, [selectedWorkflow])

  useEffect(() => {
    fetchFlowData()
  }, [fetchFlowData])

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  const toggleMetric = (metric) => {
    setExpandedMetrics(prev => ({
      ...prev,
      [metric]: !prev[metric]
    }))
  }

  // Flow Node Component
  const FlowNode = ({ title, subtitle, icon: Icon, stats, color = 'blue', isActive = false }) => {
    const colorClasses = {
      blue: 'border-blue-500 bg-blue-50',
      green: 'border-green-500 bg-green-50',
      purple: 'border-purple-500 bg-purple-50',
      orange: 'border-orange-500 bg-orange-50',
      red: 'border-red-500 bg-red-50'
    }

    return (
      <div className={`relative bg-white rounded-lg shadow-lg p-6 border-2 ${isActive ? colorClasses[color] : 'border-gray-300'} min-w-[280px]`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Icon className={`w-6 h-6 text-${color}-600`} />
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Database className="w-4 h-4 text-gray-600" />
              <span className="ml-1 text-lg font-semibold text-gray-900">{stats.total}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Activity className="w-4 h-4 text-green-600" />
              <span className="ml-1 text-lg font-semibold text-green-600">{stats.processed}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="ml-1 text-lg font-semibold text-orange-600">{stats.pending}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="ml-1 text-lg font-semibold text-red-600">{stats.failed}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Metric Card Component for Sidebar
  const MetricCard = ({ title, subtitle, value, percentage, color, expanded, onToggle, children }) => {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div 
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={onToggle}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{title}</h4>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
            <div className="flex items-center space-x-2">
              {percentage !== undefined && (
                <span className="text-lg font-bold text-gray-700">{percentage}%</span>
              )}
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </div>
          </div>
        </div>
        
        {expanded && children && (
          <div className="px-4 pb-4 border-t border-gray-200 pt-3">
            {children}
          </div>
        )}
      </div>
    )
  }

  // Connection Line Component
  const ConnectionLine = ({ from, to, label }) => {
    return (
      <div className="absolute z-0" style={{ pointerEvents: 'none' }}>
        <svg className="absolute" style={{ overflow: 'visible', top: 0, left: 0 }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#9CA3AF"
              />
            </marker>
          </defs>
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="#9CA3AF"
            strokeWidth="2"
            markerEnd="url(#arrowhead)"
          />
          {label && (
            <text
              x={(from.x + to.x) / 2}
              y={(from.y + to.y) / 2 - 5}
              textAnchor="middle"
              className="text-xs fill-gray-600"
            >
              {label}
            </text>
          )}
        </svg>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex-1 p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="space-y-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-8">
                  <div className="bg-white p-6 rounded-lg shadow h-32 w-72">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="w-80 bg-white border-l border-gray-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  // Pipeline Node Component - for showing debtors at each stage
  const PipelineNode = ({ title, count, value, color = 'blue', width = 'w-48', alerts = [] }) => {
    const colorClasses = {
      blue: 'bg-blue-100 border-blue-500 text-blue-900',
      green: 'bg-green-100 border-green-500 text-green-900',
      purple: 'bg-purple-100 border-purple-500 text-purple-900',
      orange: 'bg-orange-100 border-orange-500 text-orange-900',
      red: 'bg-red-100 border-red-500 text-red-900',
      gray: 'bg-gray-100 border-gray-500 text-gray-900'
    }

    return (
      <div className={`relative ${width} min-h-[100px] rounded-lg border-2 ${colorClasses[color]} p-4 shadow-sm`}>
        <h3 className="font-semibold text-sm mb-1">{title}</h3>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs opacity-75">{formatCurrency(value)}</p>
        {alerts.length > 0 && (
          <div className="mt-2 space-y-1">
            {alerts.map((alert, idx) => (
              <div key={idx} className="text-xs flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {alert}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Workflow Step Node - for showing individual workflow steps
  const WorkflowStepNode = ({ step, count, nextDate }) => {
    const getStepIcon = (type) => {
      switch(type) {
        case 'email': return <Mail className="w-4 h-4" />
        case 'sms': return <Send className="w-4 h-4" />
        case 'wait': return <Clock className="w-4 h-4" />
        default: return <Activity className="w-4 h-4" />
      }
    }

    const getDaysUntilNext = () => {
      if (!nextDate) return null
      const now = new Date()
      const next = new Date(nextDate)
      const days = Math.ceil((next - now) / (1000 * 60 * 60 * 24))
      return days
    }

    const daysUntil = getDaysUntilNext()

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 min-w-[180px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {getStepIcon(step.type)}
            <span className="text-sm font-medium">{step.name}</span>
          </div>
          <span className="text-xs text-gray-500">Step {step.order}</span>
        </div>
        <p className="text-xl font-bold text-gray-900">{count}</p>
        {daysUntil !== null && (
          <p className="text-xs text-gray-500 mt-1">
            {daysUntil === 0 ? 'Executing today' : 
             daysUntil > 0 ? `Next in ${daysUntil} days` : 
             `Overdue by ${Math.abs(daysUntil)} days`}
          </p>
        )}
      </div>
    )
  }

  // Stat Card Component
  const StatCard = ({ title, count, percentage, status, onViewClick, children }) => {
    const [expanded, setExpanded] = useState(false)
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <h3 className="text-gray-700 text-sm font-medium mb-4">{title}</h3>
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline space-x-3">
              <span className="text-4xl font-semibold text-gray-900">{count}</span>
              <span className="text-gray-500 text-lg">{percentage}%</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
            >
              Details
              <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            
            <button
              onClick={onViewClick}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
            >
              <Users className="w-4 h-4 mr-1" />
              View
            </button>
          </div>
        </div>
        
        {expanded && children && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            {children}
          </div>
        )}
      </div>
    )
  }

  // Calculate statistics
  const stats = {
    started: flowData.uploaded.count,
    finished: flowData.paid.count,
    suspended: flowData.escalated.count,
    inProgress: flowData.inWorkflow.count
  }

  const getPercentage = (count) => {
    return stats.started > 0 ? Math.round((count / stats.started) * 100) : 0
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Workflow Statistics</h1>
          
          {/* Date Range Selector */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Statistics date period</h3>
            <div className="flex items-center space-x-4">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500">–</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <Calendar className="w-5 h-5" />
              </button>
              <button 
                onClick={() => fetchFlowData()}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Last updated on {new Date().toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-3">
              You're viewing information on contacts who went through this automation during the selected timeframe. Change dates to explore other time periods.
            </p>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Started */}
          <StatCard
            title="Started"
            count={stats.started}
            percentage={100}
            onViewClick={() => console.log('View started')}
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Contacts added to workflows</p>
              <div className="space-y-2">
                {flowData.workflows.map(workflow => (
                  <div key={workflow.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{workflow.name}</span>
                    <span className="font-medium">{workflow.active + workflow.completed}</span>
                  </div>
                ))}
              </div>
            </div>
          </StatCard>

          {/* Finished */}
          <StatCard
            title="Finished"
            count={stats.finished}
            percentage={getPercentage(stats.finished)}
            onViewClick={() => console.log('View finished')}
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Successfully collected payments</p>
              <div className="text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700">Total Collected</span>
                  <span className="font-medium text-green-600">{formatCurrency(flowData.paid.value)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Average Payment</span>
                  <span className="font-medium">
                    {stats.finished > 0 ? formatCurrency(flowData.paid.value / stats.finished) : '$0'}
                  </span>
                </div>
              </div>
            </div>
          </StatCard>

          {/* Suspended/Escalated */}
          <StatCard
            title="Suspended"
            count={stats.suspended}
            percentage={getPercentage(stats.suspended)}
            onViewClick={() => console.log('View suspended')}
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Cases escalated for further action</p>
              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Total Value</span>
                  <span className="font-medium text-red-600">{formatCurrency(flowData.escalated.value)}</span>
                </div>
              </div>
            </div>
          </StatCard>

          {/* Contacts in Progress */}
          <StatCard
            title="Contacts in progress"
            count={stats.inProgress}
            percentage={getPercentage(stats.inProgress)}
            onViewClick={() => console.log('View in progress')}
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Currently active in workflows</p>
              <div className="text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700">Total Value</span>
                  <span className="font-medium">{formatCurrency(flowData.inWorkflow.value)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Email Open Rate</span>
                  <span className="font-medium text-blue-600">{flowData.emailMetrics.openRate}%</span>
                </div>
              </div>
            </div>
          </StatCard>
        </div>

        {/* Workflow Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Workflow Performance</h3>
          
          <div className="space-y-4">
            {flowData.workflows.map((workflow) => {
              const total = workflow.active + workflow.completed
              const isExpanded = expandedWorkflow === workflow.id
              
              return (
                <div key={workflow.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedWorkflow(isExpanded ? null : workflow.id)}
                    className="w-full p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Workflow className="w-5 h-5 text-blue-600" />
                        <div className="text-left">
                          <h4 className="font-medium text-gray-900">
                            {workflow.name}
                            {workflow.isDefault && (
                              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Default</span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {total} contacts • {workflow.active} active • {workflow.completed} completed
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Workflow Steps</h5>
                        {workflow.stepDetails.map((step) => {
                          const stepPercentage = total > 0 ? Math.round((step.count / total) * 100) : 0
                          
                          return (
                            <div key={step.order} className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  {step.type === 'email' && <Mail className="w-4 h-4 text-blue-500" />}
                                  {step.type === 'wait' && <Clock className="w-4 h-4 text-yellow-500" />}
                                  {step.type === 'sms' && <Send className="w-4 h-4 text-green-500" />}
                                  <span className="text-sm font-medium text-gray-900">
                                    Step {step.order}: {step.name}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <span className="text-sm font-medium text-gray-900">{step.count}</span>
                                  <span className="text-sm text-gray-500">{stepPercentage}%</span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${stepPercentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VisualizerPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <VisualizerContent />
      </AppLayout>
    </ProtectedRoute>
  )
} 