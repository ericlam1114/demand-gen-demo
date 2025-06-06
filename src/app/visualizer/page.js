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
  MapPin
} from 'lucide-react'
import toast from 'react-hot-toast'

function VisualizerContent() {
  const { profile, agency } = useAuth()
  const [loading, setLoading] = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState(null)
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

  // Fetch real debtor data for modal
  const fetchStageDebtors = useCallback(async (stageType, workflowId, stepNumber = null) => {
    try {
      if (stageType === 'uploaded') {
        // Get all debtors enrolled in this workflow
        const { data: enrollments, error: enrollError } = await supabase
          .from('debtor_workflows')
          .select(`
            debtor_id,
            status,
            started_at,
            debtors (
              id,
              name,
              balance_cents,
              created_at
            )
          `)
          .eq('workflow_id', workflowId)
          .limit(10)
        
        if (enrollError) {
          console.error('Error fetching uploaded debtors:', enrollError)
          return []
        }
        
        return enrollments?.map(e => e.debtors).filter(Boolean) || []
        
      } else if (stageType === 'completed') {
        // Get debtors who completed workflow or have paid/escalated status
        const [
          { data: completedDebtors, error: completedError },
          { data: paidEscalatedLetters, error: lettersError }
        ] = await Promise.all([
          supabase
            .from('debtor_workflows')
            .select(`
              debtor_id,
              debtors (
                id,
                name,
                balance_cents,
                created_at
              )
            `)
            .eq('workflow_id', workflowId)
            .eq('status', 'completed')
            .limit(5),
          supabase
            .from('letters')
            .select(`
              debtor_id,
              status,
              sent_at,
              debtors (
                id,
                name,
                balance_cents,
                created_at
              )
            `)
            .in('status', ['paid', 'escalated'])
            .limit(5)
        ])
        
        if (completedError || lettersError) {
          console.error('Error fetching completed debtors:', { completedError, lettersError })
          return []
        }
        
        const allCompleted = [
          ...(completedDebtors?.map(d => d.debtors).filter(Boolean) || []),
          ...(paidEscalatedLetters?.map(l => l.debtors).filter(Boolean) || [])
        ]
        
        // Remove duplicates based on debtor id
        const uniqueDebtors = allCompleted.filter((debtor, index, self) => 
          index === self.findIndex(d => d.id === debtor.id)
        )
        
        return uniqueDebtors.slice(0, 10)
        
      } else if (stepNumber) {
        // Get debtors currently at specific step
        const { data: stepDebtors, error: stepError } = await supabase
          .from('debtor_workflows')
          .select(`
            debtor_id,
            current_step_number,
            status,
            started_at,
            debtors (
              id,
              name,
              balance_cents,
              created_at
            )
          `)
          .eq('workflow_id', workflowId)
          .eq('current_step_number', stepNumber)
          .eq('status', 'active')
          .limit(10)
        
        if (stepError) {
          console.error('Error fetching step debtors:', stepError)
          return []
        }
        
        return stepDebtors?.map(d => d.debtors).filter(Boolean) || []
      }
      
      return []
    } catch (error) {
      console.error('Error in fetchStageDebtors:', error)
      return []
    }
  }, [])

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
    setWorkflowDetails(null) // Clear previous details
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

  // Modal handlers
  const showNodeDetails = async (stageType, stepNumber = null) => {
    if (!selectedWorkflow) return
    
    const debtors = await fetchStageDebtors(stageType, selectedWorkflow.id, stepNumber)
    
    const formatCurrency = (cents) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(cents / 100)
    }
    
    const formatDate = (dateStr) => {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    }
    
    let title = 'Stage Details'
    if (stageType === 'uploaded') title = 'Uploaded Debtors'
    else if (stageType === 'completed') title = 'Completed'
    else if (stepNumber && workflowDetails) {
      const step = workflowDetails.steps.find(s => s.step_number === stepNumber)
      if (step && step.step_type) {
        title = step.step_type.charAt(0).toUpperCase() + step.step_type.slice(1)
      } else {
        title = `Step ${stepNumber}`
      }
    }
    
    const details = debtors.map(debtor => ({
      name: debtor.name,
      amount: formatCurrency(debtor.balance_cents),
      status: debtor.letters?.[0]?.status || (debtor.debtor_workflows?.[0]?.status === 'completed' ? 'Completed' : 'Active'),
      date: formatDate(debtor.debtor_workflows?.[0]?.started_at || debtor.created_at)
    }))
    
    setModalData({
      title,
      count: stageType === 'uploaded' ? flowData.overall.uploaded.count :
             stageType === 'completed' ? flowData.overall.paid.count + flowData.overall.escalated.count :
             stepNumber && workflowDetails ? workflowDetails.steps.find(s => s.step_number === stepNumber)?.count || 0 : 0,
      details
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setModalData(null)
  }

  const getStatusColor = (status) => {
    const colors = {
      'Opened': '#dbeafe',
      'Sent': '#fef3c7',
      'Clicked': '#e0e7ff',
      'In Transit': '#fef3c7',
      'Delivered': '#d1fae5',
      'Paid': '#d1fae5',
      'Escalated': '#fee2e2'
    }
    return colors[status] || '#f3f4f6'
  }

  const getStatusTextColor = (status) => {
    const colors = {
      'Opened': '#1e40af',
      'Sent': '#92400e',
      'Clicked': '#4338ca',
      'In Transit': '#92400e',
      'Delivered': '#059669',
      'Paid': '#059669',
      'Escalated': '#dc2626'
    }
    return colors[status] || '#374151'
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Workflow Visualizer</h1>
        <p className="text-gray-600">Monitor your demand letter campaigns in real-time</p>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 cursor-pointer">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{flowData.overall.uploaded.count}</div>
            <div className="text-sm text-gray-600 mb-1">Total Debtors Uploaded</div>
            <div className="text-xs text-gray-500">Last updated 10 minutes ago</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 cursor-pointer">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{flowData.overall.active.count}</div>
            <div className="text-sm text-gray-600 mb-1">Currently In Workflow</div>
            <div className="text-xs text-gray-500">Across all stages</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 cursor-pointer">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{flowData.overall.paid.count + flowData.overall.escalated.count}</div>
            <div className="text-sm text-gray-600 mb-1">Completed</div>
            <div className="text-xs text-gray-500">{flowData.overall.paid.count} paid, {flowData.overall.escalated.count} escalated</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 cursor-pointer">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {flowData.overall.uploaded.count > 0 ? Math.round((flowData.overall.paid.count / flowData.overall.uploaded.count) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-600 mb-1">Collection Rate</div>
            <div className="text-xs text-gray-500">{formatCurrency(flowData.overall.paid.value)} collected</div>
          </div>
        </div>

        {/* Workflow Selector */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Select Workflow</h2>
          </div>
          <div className="flex gap-3">
            {flowData.workflows.map((workflow, index) => (
              <button
                key={workflow.id}
                onClick={() => selectWorkflow(workflow)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  selectedWorkflow?.id === workflow.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {workflow.name}
              </button>
            ))}
            {flowData.workflows.length === 0 && (
              <span className="text-sm text-gray-500">No workflows found</span>
            )}
          </div>
        </div>

        {/* Workflow Visualizer */}
        <div className="bg-white rounded-xl p-8 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            {selectedWorkflow ? `${selectedWorkflow.name} - Active Debtors Flow` : 'Select a workflow to view details'}
          </h3>
          
          {selectedWorkflow && workflowDetails ? (
            <div className="overflow-x-auto">
              <div className="flex items-center gap-10 min-w-max pt-12 pb-5">
                {/* Start Node - Uploaded */}
                <div 
                  className="bg-white border-2 border-gray-300 rounded-xl p-5 min-w-[200px] cursor-pointer hover:border-blue-500 hover:scale-105 transition-all duration-300"
                  onClick={() => showNodeDetails('uploaded')}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Upload className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="font-semibold text-gray-900">Uploaded</div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">{selectedWorkflow.enrolled}</div>
                  <div className="text-sm text-gray-600 mb-3">Total debtors</div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Active</span>
                      <span className="font-medium">{selectedWorkflow.active}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-600">Completed</span>
                      <span className="font-medium">{selectedWorkflow.completed}</span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Workflow Steps */}
                {workflowDetails.steps.map((step, index) => {
                  const getStepIcon = (type) => {
                    switch(type) {
                      case 'email': return <Mail className="w-5 h-5 text-orange-600" />
                      case 'sms': return <Send className="w-5 h-5 text-purple-600" />
                      case 'physical': return <MapPin className="w-5 h-5 text-purple-600" />
                      case 'wait': return <Clock className="w-5 h-5 text-gray-600" />
                      default: return <Activity className="w-5 h-5 text-blue-600" />
                    }
                  }
                  
                  const getStepIconBg = (type) => {
                    switch(type) {
                      case 'email': return 'bg-orange-100'
                      case 'sms': return 'bg-purple-100'
                      case 'physical': return 'bg-purple-100'
                      case 'wait': return 'bg-gray-100'
                      default: return 'bg-blue-100'
                    }
                  }
                  
                  // Calculate day range for this step
                  const totalDelayDays = workflowDetails.steps
                    .slice(0, index + 1)
                    .reduce((sum, s) => sum + (s.delayDays || 0), 0)
                  const nextStepDelay = index < workflowDetails.steps.length - 1 ? 
                    totalDelayDays + (workflowDetails.steps[index + 1]?.delayDays || 0) : null
                  
                  const dayRange = totalDelayDays === 0 ? 'Day 1' : 
                    nextStepDelay ? `Day ${totalDelayDays + 1}-${nextStepDelay}` : 
                    `Day ${totalDelayDays + 1}+`
                  
                  return (
                    <div key={step.id || step.step_number} className="flex items-center gap-10">
                      {/* Arrow */}
                      <div className="relative">
                        <div className="w-16 h-0.5 bg-blue-500"></div>
                        <div className="absolute -right-2 -top-1.5 w-0 h-0 border-l-[8px] border-l-blue-500 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent"></div>
                      </div>
                      
                      {/* Step Node */}
                      <div 
                        className={`bg-blue-50 border-2 border-blue-500 rounded-xl p-5 min-w-[200px] cursor-pointer hover:scale-105 transition-all duration-300 relative ${
                          step.debtorsAtStep > 0 ? 'border-blue-500' : 'border-gray-300'
                        }`}
                        onClick={() => showNodeDetails('step', step.step_number)}
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">
                          {dayRange}
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 ${getStepIconBg(step.step_type)} rounded-lg flex items-center justify-center`}>
                            {getStepIcon(step.step_type)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 capitalize">{step.step_type}</div>
                            <div className="text-xs text-gray-500">{step.name}</div>
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{step.debtorsAtStep}</div>
                        <div className="text-sm text-gray-600 mb-3">Currently at step</div>
                        <div className="border-t border-gray-200 pt-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Reached step</span>
                            <span className="font-medium">{step.uploadedToStep}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-gray-600">Step #{step.step_number}</span>
                            <span className="font-medium">{step.delayDays || 0} day delay</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Arrow to completion */}
                <div className="relative">
                  <div className="w-16 h-0.5 bg-gray-300"></div>
                  <div className="absolute -right-2 -top-1.5 w-0 h-0 border-l-[8px] border-l-gray-300 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent"></div>
                </div>

                {/* Exit Node - Completed */}
                <div 
                  className="bg-green-50 border-2 border-green-500 rounded-xl p-5 min-w-[200px] cursor-pointer hover:scale-105 transition-all duration-300"
                  onClick={() => showNodeDetails('completed')}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="font-semibold text-gray-900">Completed</div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">{flowData.overall.paid.count + flowData.overall.escalated.count}</div>
                  <div className="text-sm text-gray-600 mb-3">Workflow complete</div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Paid</span>
                      <span className="font-medium text-green-600">{flowData.overall.paid.count}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-600">Escalated</span>
                      <span className="font-medium text-red-600">{flowData.overall.escalated.count}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedWorkflow ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Loading workflow details...</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Workflow className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select a workflow above to see the flow visualization</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && modalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">{modalData.title}</h3>
              <button 
                onClick={closeModal}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <h4 className="mb-5 text-gray-700">{modalData.title} - {modalData.count} Debtors</h4>
              <div className="space-y-3">
                {modalData.details.map((debtor, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">{debtor.name}</div>
                        <div className="text-gray-600 text-sm">{debtor.amount}</div>
                      </div>
                      {debtor.status && (
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: getStatusColor(debtor.status),
                            color: getStatusTextColor(debtor.status)
                          }}
                        >
                          {debtor.status}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs">Added: {debtor.date}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                  View All
                </button>
                <button 
                  onClick={closeModal}
                  className="bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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