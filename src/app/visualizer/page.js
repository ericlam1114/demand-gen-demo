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
  const [flowData, setFlowData] = useState({
    totalDebtors: 0,
    totalValue: 0,
    workflows: [],
    overall: {
      uploaded: { count: 0, value: 0 },
      enrolled: { count: 0, value: 0 },
      active: { count: 0, value: 0 },
      completed: { count: 0, value: 0 },
      paid: { count: 0, value: 0 },
      escalated: { count: 0, value: 0 }
    }
  })
  const [workflowDetails, setWorkflowDetails] = useState(null)

  // Fetch and calculate flow data
  const fetchFlowData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all data in parallel
      const results = await Promise.all([
        supabase.from('debtors').select('id, balance_cents, created_at, name'),
        supabase.from('letters').select('id, debtor_id, status, sent_at, opened_at'),
        supabase.from('workflows').select('id, name, is_active, is_default, description'),
        supabase.from('debtor_workflows').select(`
          id,
          debtor_id,
          workflow_id,
          status,
          current_step_number,
          started_at,
          completed_at,
          workflows (name)
        `),
        supabase.from('workflow_steps').select('*'),
        supabase.from('workflow_executions').select(`
          id,
          debtor_workflow_id,
          workflow_step_id,
          step_number,
          status,
          scheduled_at,
          executed_at,
          letter_id
        `)
      ])

      // Check for errors and extract data
      const [
        { data: debtors, error: debtorsError },
        { data: letters, error: lettersError },
        { data: workflows, error: workflowsError },
        { data: enrollments, error: enrollmentsError },
        { data: workflowSteps, error: workflowStepsError },
        { data: workflowExecutions, error: workflowExecutionsError }
      ] = results

      // Log any errors
      if (workflowStepsError) {
        console.error('Workflow steps error:', workflowStepsError)
      }
      if (debtorsError) console.error('Debtors error:', debtorsError)
      if (lettersError) console.error('Letters error:', lettersError)
      if (workflowsError) console.error('Workflows error:', workflowsError)
      if (enrollmentsError) console.error('Enrollments error:', enrollmentsError)
      if (workflowExecutionsError) console.error('Workflow executions error:', workflowExecutionsError)

      // Process the data
      const totalDebtors = debtors?.length || 0
      const totalValue = debtors?.reduce((sum, d) => sum + (d.balance_cents || 0), 0) || 0
      
      console.log('Raw data:', { 
        debtors: debtors?.length || 0, 
        workflows: workflows?.length || 0, 
        workflowSteps: workflowSteps?.length || 0,
        enrollments: enrollments?.length || 0 
      })
      console.log('Workflow steps:', workflowSteps)
      
      // Helper function to get debtor value
      const getDebtorValue = (debtorId) => {
        return debtors?.find(d => d.id === debtorId)?.balance_cents || 0
      }

      // Calculate overall metrics - simple math like dashboard
      const paidCount = letters?.filter(l => l.status === 'paid').length || 0
      const escalatedCount = letters?.filter(l => l.status === 'escalated').length || 0
      
      // Simple calculation: Total - (Paid + Escalated) = Still in workflows
      const inWorkflowCount = totalDebtors - paidCount - escalatedCount
      
      // Get debtor IDs that are paid or escalated for value calculations
      const paidDebtorIds = new Set(letters?.filter(l => l.status === 'paid').map(l => l.debtor_id) || [])
      const escalatedDebtorIds = new Set(letters?.filter(l => l.status === 'escalated').map(l => l.debtor_id) || [])
      const exitedDebtorIds = new Set([...paidDebtorIds, ...escalatedDebtorIds])
      
      // Calculate values
      const inWorkflowValue = debtors?.filter(d => !exitedDebtorIds.has(d.id)).reduce((sum, d) => sum + (d.balance_cents || 0), 0) || 0
      const paidValue = letters?.filter(l => l.status === 'paid').reduce((sum, l) => sum + getDebtorValue(l.debtor_id), 0) || 0
      const escalatedValue = letters?.filter(l => l.status === 'escalated').reduce((sum, l) => sum + getDebtorValue(l.debtor_id), 0) || 0

      // Group enrollments by workflow
      const workflowGroups = {}
      workflows?.forEach(workflow => {
        workflowGroups[workflow.id] = {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          isDefault: workflow.is_default,
          isActive: workflow.is_active,
          enrolled: 0,
          active: 0,
          completed: 0,
          stepBreakdown: {},
          value: 0
        }
      })

      // Process enrollments
      enrollments?.forEach(enrollment => {
        const workflowId = enrollment.workflow_id
        if (workflowGroups[workflowId]) {
          workflowGroups[workflowId].enrolled++
          workflowGroups[workflowId].value += getDebtorValue(enrollment.debtor_id)
          
          if (enrollment.status === 'active') {
            workflowGroups[workflowId].active++
            const stepNumber = enrollment.current_step_number || 1
            workflowGroups[workflowId].stepBreakdown[stepNumber] = (workflowGroups[workflowId].stepBreakdown[stepNumber] || 0) + 1
          } else if (enrollment.status === 'completed') {
            workflowGroups[workflowId].completed++
          }
        }
      })

      // Add step details to workflows
      const processedWorkflows = Object.values(workflowGroups).map(workflow => {
        const steps = workflowSteps?.filter(s => s.workflow_id === workflow.id) || []
        console.log(`Workflow ${workflow.name} (${workflow.id}) has ${steps.length} steps:`, steps)
        
        const stepDetails = steps.map(step => ({
          number: step.step_number,
          name: step.name,
          type: step.step_type,
          delayDays: step.delay_days,
          count: workflow.stepBreakdown[step.step_number] || 0
        })).sort((a, b) => a.number - b.number)

        return {
          ...workflow,
          steps: stepDetails,
          exitedCount: workflow.enrolled - workflow.active - workflow.completed
        }
      })

      console.log('Processed workflows:', processedWorkflows)

      setFlowData({
        totalDebtors,
        totalValue,
        workflows: processedWorkflows,
        overall: {
          uploaded: { count: totalDebtors, value: totalValue },
          active: { count: inWorkflowCount, value: inWorkflowValue },
          paid: { count: paidCount, value: paidValue },
          escalated: { count: escalatedCount, value: escalatedValue }
        }
      })

    } catch (error) {
      console.error('Error fetching flow data:', error)
      toast.error('Failed to load visualizer data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlowData()
  }, [fetchFlowData])

  // Fetch detailed workflow data when a workflow is selected
  const fetchWorkflowDetails = useCallback(async (workflowId) => {
    try {
      console.log('Fetching workflow details for:', workflowId)
      
      // First get workflow steps
      const { data: workflowSteps, error: stepsError } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('step_number')

      console.log('Workflow steps result:', { workflowSteps, stepsError })

      if (stepsError) {
        console.error('Error fetching workflow steps:', stepsError)
        return
      }

      // Then get other data in parallel
      const [
        { data: enrollments, error: enrollmentsError },
        { data: letters, error: lettersError }
      ] = await Promise.all([
        supabase.from('debtor_workflows').select(`
          id,
          debtor_id,
          status,
          current_step_number,
          started_at,
          completed_at,
          debtors (id, name, balance_cents)
        `).eq('workflow_id', workflowId),
        supabase.from('letters').select('id, debtor_id, status, sent_at, opened_at')
      ])

      console.log('Enrollments and letters:', { enrollments, letters, enrollmentsError, lettersError })

      // Process step details with debtor information
      const stepsWithDetails = workflowSteps?.map(step => {
        console.log(`Processing step ${step.step_number}: ${step.name}`)
        
        // Get all debtors who have reached this step (current or past)
        const debtorsAtOrPastStep = enrollments?.filter(e => 
          e.current_step_number >= step.step_number
        ) || []
        
        // Get debtors currently at this exact step
        const debtorsCurrentlyAtStep = enrollments?.filter(e => 
          e.current_step_number === step.step_number && e.status === 'active'
        ) || []

        console.log(`Step ${step.step_number} - At/past: ${debtorsAtOrPastStep.length}, Currently at: ${debtorsCurrentlyAtStep.length}`)
        
        // Count outcomes from letters for debtors who went through this step
        const stepDebtorIds = new Set(debtorsAtOrPastStep.map(e => e.debtor_id))
        const stepLetters = letters?.filter(l => stepDebtorIds.has(l.debtor_id)) || []
        
        const paidCount = stepLetters.filter(l => l.status === 'paid').length
        const escalatedCount = stepLetters.filter(l => l.status === 'escalated').length
        const inWorkflowCount = debtorsAtOrPastStep.length - paidCount - escalatedCount

        console.log(`Step ${step.step_number} outcomes - Paid: ${paidCount}, Escalated: ${escalatedCount}, In workflow: ${inWorkflowCount}`)

        return {
          ...step,
          uploadedToStep: debtorsAtOrPastStep.length, // Total who reached this step
          debtorsAtStep: debtorsCurrentlyAtStep.length, // Currently at this step
          paidCount: paidCount, // Successfully paid
          inWorkflowCount: inWorkflowCount, // Still in workflow
          escalatedCount: escalatedCount, // Escalated cases
          debtorDetails: debtorsCurrentlyAtStep.map(e => e.debtors).filter(Boolean)
        }
      }) || []

      console.log('Steps with details:', stepsWithDetails)

      setWorkflowDetails({
        workflowId,
        steps: stepsWithDetails,
        totalEnrolled: enrollments?.length || 0,
        activeEnrollments: enrollments?.filter(e => e.status === 'active').length || 0,
        completedEnrollments: enrollments?.filter(e => e.status === 'completed').length || 0
      })

    } catch (error) {
      console.error('Error fetching workflow details:', error)
      toast.error('Failed to load workflow details')
    }
  }, [])

  const selectWorkflow = (workflow) => {
    setSelectedWorkflow(workflow)
    fetchWorkflowDetails(workflow.id)
  }

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
    started: flowData.overall.uploaded.count,
    finished: flowData.overall.paid.count,
    suspended: flowData.overall.escalated.count,
    inProgress: flowData.overall.active.count
  }

  const getPercentage = (count) => {
    return stats.started > 0 ? Math.round((count / stats.started) * 100) : 0
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Automation Visualizer</h1>
          <p className="text-gray-600">High-level overview of debtor flow through your automation workflows</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Side - Overall Stats */}
          <div className="lg:col-span-3">
            {/* Overall Flow Overview */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Overall Debtor Flow</h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between overflow-x-auto space-x-8 min-w-max">
                  {/* Uploaded */}
                  <div className="text-center min-w-[120px]">
                    <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                      <Upload className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">Uploaded</h3>
                    <p className="text-xl font-bold text-blue-600">{flowData.overall.uploaded.count}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(flowData.overall.uploaded.value)}</p>
                  </div>

                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />

                  {/* In Workflows */}
                  <div className="text-center min-w-[120px]">
                    <div className="bg-orange-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                      <Activity className="w-6 h-6 text-orange-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">In Workflows</h3>
                    <p className="text-xl font-bold text-orange-600">{flowData.overall.active.count}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(flowData.overall.active.value)}</p>
                  </div>

                  <div className="flex space-x-6">
                    {/* Paid */}
                    <div className="flex items-center">
                      <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mr-3" />
                      <div className="text-center min-w-[100px]">
                        <div className="bg-green-100 rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-1">
                          <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <h3 className="font-medium text-gray-900 text-sm">Paid</h3>
                        <p className="text-lg font-bold text-green-600">{flowData.overall.paid.count}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(flowData.overall.paid.value)}</p>
                      </div>
                    </div>
                    
                    {/* Escalated */}
                    <div className="flex items-center">
                      <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mr-3" />
                      <div className="text-center min-w-[100px]">
                        <div className="bg-red-100 rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-1">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <h3 className="font-medium text-gray-900 text-sm">Escalated</h3>
                        <p className="text-lg font-bold text-red-600">{flowData.overall.escalated.count}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(flowData.overall.escalated.value)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Workflow Details */}
            {selectedWorkflow && workflowDetails ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Workflow className="w-5 h-5 text-blue-600 mr-2" />
                    {selectedWorkflow.name} - Step Details
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {workflowDetails.totalEnrolled} total enrolled • {workflowDetails.activeEnrollments} active • {workflowDetails.completedEnrollments} completed
                  </p>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    {workflowDetails.steps.map((step) => {
                      const stepIcon = step.step_type === 'email' ? Mail : 
                                     step.step_type === 'wait' ? Clock : 
                                     step.step_type === 'sms' ? Send : 
                                     step.step_type === 'physical' ? MapPin : Activity
                      const IconComponent = stepIcon
                      
                      return (
                        <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                                {step.step_number}
                              </div>
                              <IconComponent className="w-5 h-5 text-gray-600" />
                              <div>
                                <p className="font-medium text-gray-900">{step.name}</p>
                                <p className="text-sm text-gray-500 capitalize">{step.step_type}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">{step.uploadedToStep}</p>
                              <p className="text-sm text-gray-500">uploaded to step</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-3 mt-3">
                            <div className="text-center p-2 bg-blue-50 rounded">
                              <p className="text-sm font-bold text-blue-600">{step.debtorsAtStep}</p>
                              <p className="text-xs text-gray-600">At This Step</p>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded">
                              <p className="text-sm font-bold text-green-600">{step.paidCount}</p>
                              <p className="text-xs text-gray-600">Paid</p>
                            </div>
                            <div className="text-center p-2 bg-orange-50 rounded">
                              <p className="text-sm font-bold text-orange-600">{step.inWorkflowCount}</p>
                              <p className="text-xs text-gray-600">In Workflows</p>
                            </div>
                            <div className="text-center p-2 bg-red-50 rounded">
                              <p className="text-sm font-bold text-red-600">{step.escalatedCount}</p>
                              <p className="text-xs text-gray-600">Escalated</p>
                            </div>
                          </div>

                          {step.debtorDetails.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs text-gray-500 mb-2">Debtors currently at this step:</p>
                              <div className="flex flex-wrap gap-1">
                                {step.debtorDetails.slice(0, 5).map((debtor) => (
                                  <span key={debtor.id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                    {debtor.name}
                                  </span>
                                ))}
                                {step.debtorDetails.length > 5 && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                                    +{step.debtorDetails.length - 5} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Workflow className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Workflow</h3>
                <p className="text-gray-500">Choose a workflow from the sidebar to see detailed step-by-step breakdown</p>
              </div>
            )}
          </div>

          {/* Right Side - Workflow Selector */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Workflows</h3>
              </div>
              <div className="p-4 space-y-2">
                {flowData.workflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    onClick={() => selectWorkflow(workflow)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedWorkflow?.id === workflow.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{workflow.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {workflow.steps?.length || 0} steps • {workflow.enrolled} enrolled
                          {workflow.isDefault && (
                            <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">Default</span>
                          )}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </button>
                ))}
                {flowData.workflows.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No workflows found</p>
                  </div>
                )}
              </div>
            </div>
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