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
  Activity,
  Send
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Flow Diagram Area */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Users className="w-6 h-6 mr-2" />
                User Initializing
              </h1>
              <p className="text-gray-500">Initializing for Automation</p>
            </div>
            
            {/* Workflow Tabs */}
            <div className="flex items-center space-x-4">
              {flowData.workflows.map((workflow, index) => (
                <button
                  key={workflow.id}
                  onClick={() => setSelectedWorkflow(workflow)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedWorkflow?.id === workflow.id 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {workflow.name}
                </button>
              ))}
            </div>
          </div>

          {/* Flow Diagram */}
          <div className="relative" style={{ minHeight: '600px' }}>
            {/* Initialize Data Node */}
            <div className="absolute" style={{ top: '0px', left: '50px' }}>
              <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                Initialize Data
              </div>
            </div>

            {/* Setup Automation Node */}
            <div className="absolute" style={{ top: '0px', right: '50px' }}>
              <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                Setup Automation
              </div>
            </div>

            {/* Data Collection Node */}
            <div className="absolute" style={{ top: '100px', left: '50px' }}>
              <FlowNode
                title="Data Collection"
                subtitle="Gathering Data Connected"
                icon={Database}
                stats={flowData.nodes.dataCollection}
                color="blue"
                isActive={true}
              />
            </div>

            {/* Trigger Automation Node */}
            <div className="absolute" style={{ top: '100px', right: '50px' }}>
              <FlowNode
                title="Trigger Automation"
                subtitle="Workflows on Triggers"
                icon={Zap}
                stats={flowData.nodes.triggerAutomation}
                color="purple"
                isActive={true}
              />
            </div>

            {/* Data Validation Node */}
            <div className="absolute" style={{ top: '280px', left: '200px' }}>
              <FlowNode
                title="Data Validation"
                subtitle="Ensuring Data Accuracy"
                icon={Filter}
                stats={flowData.nodes.dataValidation}
                color="blue"
              />
            </div>

            {/* Action Trigger Node */}
            <div className="absolute" style={{ top: '460px', left: '200px' }}>
              <FlowNode
                title="Action Trigger"
                subtitle="Performing Tasks Conditions"
                icon={Target}
                stats={flowData.nodes.actionTrigger}
                color="orange"
              />
            </div>

            {/* Output Generation Node */}
            <div className="absolute" style={{ top: '640px', left: '200px' }}>
              <FlowNode
                title="Output Generation"
                subtitle="Compiling Delivering Outputs"
                icon={Package}
                stats={flowData.nodes.outputGeneration}
                color="green"
              />
            </div>

            {/* Connection lines would go here - in a real implementation, these would be SVG paths */}
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full">
                {/* Initialize to Data Collection */}
                <line x1="150" y1="40" x2="150" y2="100" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrowhead)" />
                {/* Setup to Trigger */}
                <line x1="600" y1="40" x2="600" y2="100" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrowhead)" />
                {/* Data Collection to Validation */}
                <line x1="190" y1="200" x2="300" y2="280" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrowhead)" />
                {/* Trigger to Validation */}
                <line x1="560" y1="200" x2="450" y2="280" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrowhead)" />
                {/* Validation to Action */}
                <line x1="340" y1="380" x2="340" y2="460" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrowhead)" />
                {/* Action to Output */}
                <line x1="340" y1="560" x2="340" y2="640" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrowhead)" />
                
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#CBD5E1" />
                  </marker>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Insight Metrics */}
      <div className="w-96 bg-gray-100 border-l border-gray-200 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Insight Metrics</h2>
            <button className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search Here..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-4">
            {/* Automation Coverage */}
            <MetricCard
              title="Automation Coverage"
              subtitle={`Your last week is better ${Math.round((flowData.inWorkflow.count / flowData.uploaded.count) * 100) || 0}%`}
              percentage={Math.round((flowData.inWorkflow.count / flowData.uploaded.count) * 100) || 0}
              expanded={expandedMetrics.coverage}
              onToggle={() => toggleMetric('coverage')}
            />

            {/* Workflow Metrics */}
            {flowData.workflows.slice(0, 2).map((workflow, index) => (
              <MetricCard
                key={workflow.id}
                title={`Workflow ${String.fromCharCode(65 + index)}`}
                subtitle={workflow.isDefault ? 'Default Workflow' : 'Triggered by User Actions'}
                expanded={expandedMetrics[`workflow${String.fromCharCode(65 + index)}`]}
                onToggle={() => toggleMetric(`workflow${String.fromCharCode(65 + index)}`)}
              >
                <div className="space-y-3">
                  {workflow.stepDetails.map((step) => (
                    <div key={step.order} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          step.type === 'email' ? 'bg-blue-500' : 
                          step.type === 'wait' ? 'bg-yellow-500' : 
                          'bg-green-500'
                        }`} />
                        <span className="text-xs text-gray-600">{step.name}</span>
                      </div>
                      <span className="text-xs font-medium text-gray-900">{step.count}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Task: {workflow.active + workflow.completed}</span>
                      <span className="text-gray-600">Exec: {workflow.active}</span>
                      <span className="text-gray-600">Done: {workflow.completed}</span>
                    </div>
                  </div>
                </div>
              </MetricCard>
            ))}

            {/* Flow Objectives */}
            <MetricCard
              title="Flow Objectives"
              subtitle=""
              expanded={expandedMetrics.objectives}
              onToggle={() => toggleMetric('objectives')}
            >
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium text-gray-900">Output Generation</h5>
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">Compiling Delivering Outputs</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center">
                      <Activity className="w-4 h-4 text-gray-600 mr-1" />
                      <span>{flowData.nodes.outputGeneration.total}</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                      <span className="text-green-600">{flowData.nodes.outputGeneration.processed}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 text-orange-600 mr-1" />
                      <span className="text-orange-600">{flowData.nodes.outputGeneration.pending}</span>
                    </div>
                    <div className="flex items-center">
                      <Zap className="w-4 h-4 text-purple-600 mr-1" />
                      <span className="text-purple-600">{flowData.paid.count}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium text-gray-900">Lorem Ipsum</h5>
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">Lorem Ipsum Sit Dolor</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center">
                      <Database className="w-4 h-4 text-gray-600 mr-1" />
                      <span>{flowData.uploaded.count}</span>
                    </div>
                    <div className="flex items-center">
                      <Activity className="w-4 h-4 text-green-600 mr-1" />
                      <span className="text-green-600">{flowData.inWorkflow.count}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 text-orange-600 mr-1" />
                      <span className="text-orange-600">{flowData.completed.count}</span>
                    </div>
                    <div className="flex items-center">
                      <Zap className="w-4 h-4 text-purple-600 mr-1" />
                      <span className="text-purple-600">{flowData.escalated.count}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium text-gray-900">Action Trigger</h5>
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">Performing Tasks Conditions</p>
                </div>
              </div>
            </MetricCard>
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