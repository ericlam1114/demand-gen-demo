'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/components/auth/AuthProvider'
import { PlanRestrictionBanner, PlanFeatureLock } from '@/components/ui/plan-restriction-banner'
import { 
  hasFeature, 
  getAllowedStepTypes, 
  getUpgradeMessage,
  getWorkflowLimits,
  canCreateWorkflow,
  getWorkflowUpgradeMessage,
  getDefaultWorkflowLimits,
  canSetAsDefault,
  getDefaultWorkflowMessage,
  getActiveWorkflowLimits,
  canCreateActiveWorkflow,
  getWorkflowMessage
} from '@/lib/plan-restrictions'
import { 
  Plus, 
  Mail, 
  MessageSquare, 
  MapPin, 
  Clock, 
  Save, 
  Play, 
  Pause, 
  Trash2,
  Edit3,
  Copy,
  Settings,
  ChevronDown,
  ChevronRight,
  Target,
  Calendar,
  DollarSign,
  Star,
  StarOff,
  Crown,
  AlertCircle,
  GitBranch,
  Eye,
  X,
  Upload,
  CheckCircle,
  Activity
} from 'lucide-react'
import toast from 'react-hot-toast'

const WORKFLOW_STEPS = [
  {
    id: 'email',
    name: 'Send Email',
    icon: Mail,
    color: 'bg-blue-500',
    description: 'Send demand letter via email',
    channels: ['email'],
    requiredPlan: 'free'
  },
  {
    id: 'sms',
    name: 'Send SMS',
    icon: MessageSquare,
    color: 'bg-green-500',
    description: 'Send reminder via SMS',
    channels: ['sms'],
    requiredPlan: 'professional'
  },
  {
    id: 'physical',
    name: 'Physical Mail',
    icon: MapPin,
    color: 'bg-purple-500',
    description: 'Send physical letter',
    channels: ['physical'],
    requiredPlan: 'free'
  },
  {
    id: 'wait',
    name: 'Wait',
    icon: Clock,
    color: 'bg-gray-500',
    description: 'Wait for specified time',
    channels: ['wait'],
    requiredPlan: 'professional'
  }
]

function WorkflowsContent() {
  const { profile, agency } = useAuth()
  const currentPlan = agency?.plan || 'free'
  
  const [workflows, setWorkflows] = useState([])
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)
  const [workflowSteps, setWorkflowSteps] = useState([])
  const [templates, setTemplates] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showStepConfig, setShowStepConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewWorkflow, setPreviewWorkflow] = useState(null)

  // Form state
  const [workflowForm, setWorkflowForm] = useState({
    name: '',
    description: '',
    is_default: false,
    is_active: true
  })

  // Check if workflows feature is available
  const workflowsEnabled = hasFeature(currentPlan, 'workflows')
  const allowedStepTypes = getAllowedStepTypes(currentPlan)
  const workflowLimits = getWorkflowLimits(currentPlan)
  const canCreateMore = canCreateWorkflow(currentPlan, workflows.length)
  
  // Default and active workflow limits
  const defaultWorkflowLimits = getDefaultWorkflowLimits(currentPlan)
  const activeWorkflowLimits = getActiveWorkflowLimits(currentPlan)
  const currentDefaultCount = workflows.filter(w => w.is_default).length
  const currentActiveCount = workflows.filter(w => !w.is_default && w.is_active).length
  const canSetMoreDefaults = canSetAsDefault(currentPlan, currentDefaultCount)
  const canCreateMoreActive = canCreateActiveWorkflow(currentPlan, currentActiveCount)

  useEffect(() => {
    const loadData = async () => {
      await fetchWorkflows()
      await fetchTemplates()
      setLoading(false)
    }
    loadData()
  }, [])

  const fetchWorkflows = async () => {
    console.log('[Workflow] Fetching workflows...')
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select(`
          *,
          workflow_steps (
            id,
            step_number,
            step_type,
            delay_days,
            delay_hours,
            template_id,
            templates (
              name,
              email_subject
            )
          )
        `)
        .order('created_at', { ascending: false })

      console.log('[Workflow] Fetch workflows result:', { 
        dataCount: data?.length || 0, 
        error,
        data: data?.map(w => ({ id: w.id, name: w.name, steps: w.workflow_steps?.length || 0 }))
      })

      if (error) {
        console.log('[Workflow] Workflows query error:', error)
        // Handle RLS issues gracefully
        setWorkflows([])
        return
      }

      console.log('[Workflow] Setting workflows:', data?.length || 0, 'workflows')
      setWorkflows(data || [])
      
      if (data && data.length > 0 && !selectedWorkflow) {
        console.log('[Workflow] Auto-selecting first workflow:', data[0].name)
        selectWorkflow(data[0])
      }
    } catch (error) {
      console.error('[Workflow] Error fetching workflows:', error)
      setWorkflows([])
    }
  }

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, email_subject, channel')
        .order('name')

      if (error) {
        console.log('Templates query error:', error)
        setTemplates([])
        return
      }

      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      setTemplates([])
    }
  }

  const selectWorkflow = (workflow) => {
    setSelectedWorkflow(workflow)
    setWorkflowSteps(workflow.workflow_steps || [])
    setWorkflowForm({
      name: workflow.name,
      description: workflow.description || '',
      is_default: workflow.is_default,
      is_active: workflow.is_active
    })
    setIsEditing(false)
  }

  const createNewWorkflow = () => {
    if (!canCreateMore) {
      toast.error(getWorkflowUpgradeMessage(currentPlan, workflows.length))
      return
    }

    // Determine if this should be default based on plan and existing workflows
    let shouldBeDefault = false
    if (workflows.length === 0) {
      shouldBeDefault = true // First workflow becomes default
    } else if (currentPlan !== 'enterprise' && currentDefaultCount === 0) {
      shouldBeDefault = true // Non-enterprise plans need a default
    }

    setEditingWorkflow(null) // This indicates we're creating new
    setSelectedWorkflow(null)
    setWorkflowSteps([
      {
        step_number: 1,
        step_type: 'email',
        delay_days: 0,
        delay_hours: 0,
        template_id: templates[0]?.id || null
      }
    ])
    setWorkflowForm({
      name: 'New Workflow',
      description: '',
      is_default: shouldBeDefault,
      is_active: true
    })
    setIsEditing(true)
    setShowEditModal(true)
  }

  const saveWorkflow = async () => {
    console.log('[Workflow] Save workflow called')
    console.log('[Workflow] Form data:', workflowForm)
    console.log('[Workflow] Workflow steps:', workflowSteps)
    console.log('[Workflow] Selected workflow:', selectedWorkflow)
    
    if (!workflowForm.name.trim()) {
      toast.error('Please provide a workflow name')
      return
    }

    if (workflowSteps.length === 0) {
      toast.error('Please add at least one step to the workflow')
      return
    }

    // Ensure all steps have valid templates
    const invalidSteps = workflowSteps.filter((step, index) => {
      if (step.step_type === 'wait') return false // Wait steps don't need templates
      return !step.template_id
    })

    if (invalidSteps.length > 0) {
      toast.error('Please select a template for all email, SMS, and physical mail steps')
      return
    }

    // Check workflow limits for new workflows
    if (!editingWorkflow && !canCreateMore) {
      toast.error(getWorkflowUpgradeMessage(currentPlan, workflows.length))
      return
    }

    setIsSaving(true)
    try {
      let workflowId = editingWorkflow?.id

      // If this workflow is being set as default, remove default from others first
      if (workflowForm.is_default) {
        console.log('[Workflow] Setting as default, clearing others')
        const { error: defaultError } = await supabase
          .from('workflows')
          .update({ is_default: false })
          .neq('id', workflowId || 'new')
          
        console.log('[Workflow] Clear default result:', { error: defaultError })
        if (defaultError) console.log('Warning: Could not clear other defaults:', defaultError)
      }

      if (editingWorkflow) {
        console.log('[Workflow] Updating existing workflow:', editingWorkflow.id)
        // Update existing workflow
        const { error: workflowError } = await supabase
          .from('workflows')
          .update({
            name: workflowForm.name,
            description: workflowForm.description,
            is_default: workflowForm.is_default,
            is_active: workflowForm.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingWorkflow.id)

        console.log('[Workflow] Update workflow result:', { error: workflowError })
        if (workflowError) throw workflowError

        console.log('[Workflow] Clearing existing workflow executions and steps for workflow:', editingWorkflow.id)
        
        // First, get all workflow steps for this workflow
        const { data: existingSteps, error: getStepsError } = await supabase
          .from('workflow_steps')
          .select('id')
          .eq('workflow_id', editingWorkflow.id)
        
        if (getStepsError) {
          console.error('Error getting existing steps:', getStepsError)
          throw getStepsError
        }
        
        console.log('[Workflow] Found existing steps:', existingSteps)
        
        // Delete workflow executions that reference these steps
        if (existingSteps && existingSteps.length > 0) {
          const stepIds = existingSteps.map(step => step.id)
          console.log('[Workflow] Deleting workflow executions for step IDs:', stepIds)
          
          const { error: deleteExecutionsError } = await supabase
            .from('workflow_executions')
            .delete()
            .in('workflow_step_id', stepIds)
          
          console.log('[Workflow] Delete executions result:', { error: deleteExecutionsError })
          if (deleteExecutionsError) {
            console.error('Error deleting workflow executions:', deleteExecutionsError)
            throw deleteExecutionsError
          }
        }
        
        // Now delete the workflow steps
        const { error: clearError } = await supabase
          .from('workflow_steps')
          .delete()
          .eq('workflow_id', editingWorkflow.id)
          
        console.log('[Workflow] Clear steps result:', { error: clearError })
        if (clearError) {
          console.error('Error clearing existing steps:', clearError)
          throw clearError
        }
      } else {
        console.log('[Workflow] Creating new workflow')
        // Create new workflow
        const { data: newWorkflow, error: workflowError } = await supabase
          .from('workflows')
          .insert({
            name: workflowForm.name,
            description: workflowForm.description,
            is_default: workflowForm.is_default,
            is_active: workflowForm.is_active,
            agency_id: null // Will be set properly with auth
          })
          .select()
          .single()

        console.log('[Workflow] Create workflow result:', { data: newWorkflow, error: workflowError })
        if (workflowError) throw workflowError
        workflowId = newWorkflow.id
        console.log('[Workflow] New workflow ID:', workflowId)
      }

      // Insert workflow steps - ensure correct step numbering
      console.log('[Workflow] Current workflowSteps state:', workflowSteps)
      const stepsToInsert = workflowSteps.map((step, index) => ({
        workflow_id: workflowId,
        step_number: index + 1, // Use array index for correct ordering
        step_type: step.step_type,
        delay_days: step.delay_days || 0,
        delay_hours: step.delay_hours || 0,
        template_id: step.template_id || null
      }))

      console.log('[Workflow] Steps to insert:', stepsToInsert)
      const { error: stepsError } = await supabase
        .from('workflow_steps')
        .insert(stepsToInsert)

      console.log('[Workflow] Insert steps result:', { error: stepsError })
      if (stepsError) throw stepsError

      toast.success(editingWorkflow ? 'Workflow updated successfully' : 'Workflow created successfully')
      console.log('[Workflow] Save successful, refreshing workflows')
      fetchWorkflows()
      setIsEditing(false)
      setShowEditModal(false)
      setEditingWorkflow(null)
    } catch (error) {
      console.error('[Workflow] Error saving workflow:', error)
      toast.error('Failed to save workflow: ' + (error.message || 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  const addStep = () => {
    const newStep = {
      step_number: workflowSteps.length + 1,
      step_type: 'email',
      delay_days: workflowSteps.length === 0 ? 0 : 7, // First step immediate, others 7 days
      delay_hours: 0,
      template_id: templates[0]?.id || null
    }
    setWorkflowSteps([...workflowSteps, newStep])
  }

  const updateStep = (index, field, value) => {
    const updated = [...workflowSteps]
    updated[index] = { ...updated[index], [field]: value }
    
    // If step type changed, clear template if it doesn't match the new type
    if (field === 'step_type') {
      const currentTemplate = templates.find(t => t.id === updated[index].template_id)
      if (currentTemplate && currentTemplate.channel !== value) {
        updated[index].template_id = null
      }
    }
    
    setWorkflowSteps(updated)
  }

  const removeStep = (index) => {
    console.log('[Workflow] Removing step at index:', index)
    console.log('[Workflow] Current steps before removal:', workflowSteps)
    const updated = workflowSteps.filter((_, i) => i !== index)
    // Renumber steps
    const renumbered = updated.map((step, i) => ({ ...step, step_number: i + 1 }))
    console.log('[Workflow] Steps after removal and renumbering:', renumbered)
    setWorkflowSteps(renumbered)
  }

  const toggleDefault = async (workflowId) => {
    try {
      // Get the current workflow to check if it's already default
      const currentWorkflow = workflows.find(w => w.id === workflowId)
      
      if (currentWorkflow?.is_default) {
        // If it's already default, remove the default status
        const { error } = await supabase
          .from('workflows')
          .update({ is_default: false })
          .eq('id', workflowId)

        if (error) throw error
        toast.success('Default workflow removed')
      } else {
        // Check if we can set more defaults based on plan
        if (!canSetMoreDefaults) {
          toast.error(getDefaultWorkflowMessage(currentPlan))
          return
        }

        // For non-enterprise plans, remove default from all others first
        if (currentPlan !== 'enterprise') {
          const { error: clearError } = await supabase
        .from('workflows')
        .update({ is_default: false })
            .neq('id', workflowId)

          if (clearError) throw clearError
        }

        // Set this one as default
      const { error } = await supabase
        .from('workflows')
        .update({ is_default: true })
        .eq('id', workflowId)

      if (error) throw error
      toast.success('Default workflow updated')
      }

      fetchWorkflows()
    } catch (error) {
      console.error('Error updating default workflow:', error)
      toast.error('Failed to update default workflow')
    }
  }

  const deleteWorkflow = async (workflowId) => {
    try {
      const workflowToDelete = workflows.find(w => w.id === workflowId)
      
      // Check if this workflow has active enrollments
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('debtor_workflows')
        .select('id')
        .eq('workflow_id', workflowId)
        .eq('status', 'active')
        .limit(1)

      if (enrollmentError) throw enrollmentError

      if (enrollments && enrollments.length > 0) {
        toast.error('Cannot delete workflow: It has active debtor enrollments')
        return
      }

      // Confirm deletion
      if (!confirm(`Are you sure you want to delete "${workflowToDelete?.name}"? This action cannot be undone.`)) {
        return
      }

      // Delete the workflow (cascade delete will handle steps and enrollments)
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflowId)

      if (error) throw error

      toast.success('Workflow deleted successfully')
      
      // If the deleted workflow was selected, clear selection
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null)
        setWorkflowSteps([])
        setIsEditing(false)
      }

      fetchWorkflows()
    } catch (error) {
      console.error('Error deleting workflow:', error)
      toast.error('Failed to delete workflow: ' + (error.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow h-96"></div>
              </div>
              <div className="lg:col-span-3">
                <div className="bg-white rounded-lg shadow h-96"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const editWorkflow = (workflow) => {
    setEditingWorkflow(workflow)
    setSelectedWorkflow(workflow)
    setWorkflowSteps(workflow.workflow_steps || [])
    setWorkflowForm({
      name: workflow.name,
      description: workflow.description || '',
      is_default: workflow.is_default,
      is_active: workflow.is_active
    })
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingWorkflow(null)
    setIsEditing(false)
  }

  const previewWorkflowFlow = (workflow) => {
    setPreviewWorkflow(workflow)
    setShowPreviewModal(true)
  }

  const closePreviewModal = () => {
    setShowPreviewModal(false)
    setPreviewWorkflow(null)
  }

  const getWorkflowIcon = (workflow) => {
    if (workflow.is_default) return '⭐'
    const stepTypes = workflow.workflow_steps?.map(s => s.step_type) || []
    if (stepTypes.includes('physical')) return '📮'
    if (stepTypes.includes('sms')) return '💬'
    return '✉️'
  }

  const getWorkflowIconBg = (workflow) => {
    if (workflow.is_default) return 'background: #dbeafe; color: #2563eb;'
    const stepTypes = workflow.workflow_steps?.map(s => s.step_type) || []
    if (stepTypes.includes('physical')) return 'background: #e0e7ff; color: #6366f1;'
    if (stepTypes.includes('sms')) return 'background: #fee2e2; color: #ef4444;'
    return 'background: #dbeafe; color: #2563eb;'
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
          <p className="mt-2 text-gray-600">Manage your automated collection workflows</p>
        </div>

        {/* Plan Restriction Banner for Free Tier */}
        {!workflowsEnabled && (
          <PlanRestrictionBanner
            planName={currentPlan}
            featureName="workflows"
            upgradeMessage={getUpgradeMessage(currentPlan, 'workflows')}
            className="mb-6"
          />
        )}

        {/* Workflow Limits Info */}
        {workflowsEnabled && (
          <div className="mb-6 space-y-4">
            {/* Overall Plan Description */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-slate-600 mr-2" />
                <span className="text-sm text-slate-800">
                  <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan:</strong> {getWorkflowMessage(currentPlan)}
                </span>
              </div>
            </div>
            
            {/* Workflow Count Limits */}
            {workflowLimits.limit !== -1 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-sm text-blue-800">
                      <strong>{workflows.length}/{workflowLimits.limit}</strong> total workflows used
                      {currentPlan === 'professional' && ' (only 1 can run at a time)'}
                    </span>
                  </div>
                  {!canCreateMore && (
                    <Button size="sm" variant="outline">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade for More
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {/* Default Workflow Status */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Star className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="text-sm text-yellow-800">
                    <strong>Default Workflow:</strong> {currentDefaultCount > 0 ? workflows.find(w => w.is_default)?.name || 'Unnamed' : 'None set'}
                    {currentPlan === 'enterprise' && ' (for quick actions & fallback)'}
                  </span>
                </div>
                {currentDefaultCount === 0 && (
                  <span className="text-xs text-yellow-700">
                    Set one workflow as default
                  </span>
                )}
              </div>
            </div>
            
            {/* Active Workflows for Enterprise */}
            {currentPlan === 'enterprise' && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Crown className="w-5 h-5 text-purple-600 mr-2" />
                    <span className="text-sm text-purple-800">
                      <strong>Active Workflows:</strong> {currentActiveCount} available for API/CSV assignment
                      <br />
                      <span className="text-xs text-purple-600">These can run in parallel and be assigned via API or CSV upload</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Workflow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className={`relative bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
                workflow.is_default ? 'border-2 border-blue-500' : 'border border-gray-200'
              } ${!workflowsEnabled ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => workflowsEnabled && editWorkflow(workflow)}
            >
              {workflow.is_default && (
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg z-10">
                  DEFAULT
                </div>
              )}
              
              {/* Workflow Header */}
              <div className="flex items-start gap-4 mb-5">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ ...Object.fromEntries(getWorkflowIconBg(workflow).split(';').map(s => s.split(':').map(p => p.trim()))) }}
                >
                  {getWorkflowIcon(workflow)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{workflow.name}</h3>
                  <div className="text-sm text-gray-600">{workflow.workflow_steps?.length || 0} steps</div>
                </div>
              </div>
              
              {/* Workflow Status */}
              <div className="flex items-center gap-2 mb-5">
                <div className={`w-2 h-2 rounded-full ${
                  workflow.is_active ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <span className="text-sm text-gray-600">
                  {workflow.is_active ? 'Active • Executes immediately' : 'Inactive'}
                </span>
              </div>
              
              {/* Steps Preview */}
              <div className="border-t border-gray-200 pt-5 mb-5">
                <div className="space-y-3">
                  {(workflow.workflow_steps || []).slice(0, 3).map((step, index) => (
                    <div key={step.id || index} className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {step.step_type === 'email' ? 'Send Email' :
                           step.step_type === 'sms' ? 'SMS Reminder' :
                           step.step_type === 'physical' ? 'Physical Mail' :
                           step.step_type === 'wait' ? 'Wait' : step.step_type}
                        </div>
                        <div className="text-xs text-gray-500">
                          {index === 0 ? 'Executes immediately' : 
                           `Executes ${step.delay_days || 0} days after previous step`}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(workflow.workflow_steps?.length || 0) > 3 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{workflow.workflow_steps.length - 3} more steps
                    </div>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 border-t border-gray-200 pt-5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (workflowsEnabled) {
                      editWorkflow(workflow)
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  disabled={!workflowsEnabled}
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (workflowsEnabled) {
                      previewWorkflowFlow(workflow)
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  disabled={!workflowsEnabled}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              </div>
            </div>
          ))}
          
          {/* Add New Workflow Card */}
          {workflowsEnabled && canCreateMore && (
            <div
              className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={createNewWorkflow}
            >
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Create New Workflow</h3>
              <p className="text-sm text-gray-600">Build an automated collection sequence</p>
            </div>
          )}
        </div>
        
        {workflows.length === 0 && workflowsEnabled && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <GitBranch className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Workflows Yet</h3>
            <p className="text-gray-600 mb-6">Create your first automated workflow to get started</p>
            <button 
              onClick={createNewWorkflow} 
              disabled={!canCreateMore}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Create First Workflow
            </button>
          </div>
        )}

        {/* Edit Workflow Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeEditModal}>
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">{editingWorkflow ? 'Edit Workflow Steps' : 'Create New Workflow'}</h3>
                <button 
                  onClick={closeEditModal}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                {/* Workflow Basic Info */}
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Workflow Name</label>
                      <input
                        type="text"
                        value={workflowForm.name}
                        onChange={(e) => setWorkflowForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Workflow name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <input
                        type="text"
                        value={workflowForm.description}
                        onChange={(e) => setWorkflowForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Workflow description"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={workflowForm.is_default}
                        onChange={(e) => setWorkflowForm(prev => ({ ...prev, is_default: e.target.checked }))}
                        className="mr-2 rounded"
                      />
                      <span className="text-sm text-gray-700">Set as default workflow</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={workflowForm.is_active}
                        onChange={(e) => setWorkflowForm(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="mr-2 rounded"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>
                
                <h4 className="text-lg font-medium text-gray-900 mb-4">Workflow Steps</h4>
                
                <div className="space-y-4 mb-6">
                  {workflowSteps.map((step, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="flex items-center gap-3">
                          <span className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                            {index + 1}
                          </span>
                          <span className="font-medium">Step {index + 1}: {WORKFLOW_STEPS.find(s => s.id === step.step_type)?.name || step.step_type}</span>
                        </h5>
                        <button
                          onClick={() => removeStep(index)}
                          className="text-red-600 hover:text-red-700 px-3 py-1 text-sm font-medium"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">⚙️ Action Type</label>
                          <select
                            value={step.step_type}
                            onChange={(e) => updateStep(index, 'step_type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {WORKFLOW_STEPS.map(stepType => {
                              const isAllowed = allowedStepTypes.includes(stepType.id)
                              return (
                                <option 
                                  key={stepType.id} 
                                  value={stepType.id}
                                  disabled={!isAllowed}
                                >
                                  {stepType.name} {!isAllowed ? '(Upgrade Required)' : ''}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                        
                        {step.step_type !== 'wait' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">📄 Template</label>
                            <select
                              value={step.template_id || ''}
                              onChange={(e) => updateStep(index, 'template_id', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select template</option>
                              {templates
                                .filter(template => template.channel === step.step_type)
                                .map(template => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        {index > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">⏱️ Delay (Days)</label>
                            <input
                              type="number"
                              min="0"
                              max="365"
                              value={step.delay_days || 0}
                              onChange={(e) => updateStep(index, 'delay_days', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={addStep}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors mb-6 border border-gray-300"
                >
                  ➕ Add Step
                </button>
                
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={saveWorkflow}
                    disabled={isSaving}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : (editingWorkflow ? 'Save Changes' : 'Create Workflow')}
                  </button>
                  <button
                    onClick={closeEditModal}
                    className="bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Workflow Modal */}
        {showPreviewModal && previewWorkflow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closePreviewModal}>
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">Workflow Preview: {previewWorkflow.name}</h3>
                <button 
                  onClick={closePreviewModal}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="overflow-x-auto">
                  <div className="flex items-center gap-10 min-w-max pt-12 pb-5">
                    {/* Start Node - Uploaded */}
                    <div className="bg-white border-2 border-gray-300 rounded-xl p-5 min-w-[200px]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Upload className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="font-semibold text-gray-900">Uploaded</div>
                      </div>
                      <div className="text-lg text-gray-600 mb-3">Debtors enter workflow</div>
                      <div className="border-t border-gray-200 pt-3">
                        <div className="text-xs text-gray-500">Starting point for all debtors</div>
                      </div>
                    </div>

                    {/* Dynamic Workflow Steps */}
                    {(previewWorkflow.workflow_steps || []).map((step, index) => {
                      const getStepIcon = (type) => {
                        switch(type) {
                          case 'email': return <Mail className="w-5 h-5 text-orange-600" />
                          case 'sms': return <MessageSquare className="w-5 h-5 text-purple-600" />
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
                      
                      const getStepName = (type) => {
                        switch(type) {
                          case 'email': return 'Email'
                          case 'sms': return 'SMS'
                          case 'physical': return 'Physical Mail'
                          case 'wait': return 'Wait'
                          default: return type
                        }
                      }
                      
                      // Calculate day timing
                      const dayLabel = step.delay_days === 0 ? 'Immediate' : 
                        step.delay_days === 1 ? 'Next Day' : 
                        `After ${step.delay_days} Days`
                      
                      return (
                        <div key={step.id || index} className="flex items-center gap-10">
                          {/* Arrow */}
                          <div className="relative">
                            <div className="w-16 h-0.5 bg-blue-500"></div>
                            <div className="absolute -right-2 -top-1.5 w-0 h-0 border-l-[8px] border-l-blue-500 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent"></div>
                          </div>
                          
                          {/* Step Node */}
                          <div className="bg-blue-50 border-2 border-blue-500 rounded-xl p-5 min-w-[200px] relative">
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">
                              {dayLabel}
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                              <div className={`w-10 h-10 ${getStepIconBg(step.step_type)} rounded-lg flex items-center justify-center`}>
                                {getStepIcon(step.step_type)}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 capitalize">{getStepName(step.step_type)}</div>
                                <div className="text-xs text-gray-500">Step {index + 1}</div>
                              </div>
                            </div>
                            <div className="text-lg text-gray-600 mb-3">
                              {step.step_type === 'email' ? 'Send email to debtor' :
                               step.step_type === 'sms' ? 'Send SMS reminder' :
                               step.step_type === 'physical' ? 'Send physical letter' :
                               step.step_type === 'wait' ? `Wait ${step.delay_days} days` :
                               'Execute step'}
                            </div>
                            <div className="border-t border-gray-200 pt-3">
                              <div className="text-xs text-gray-500">
                                {step.delay_days === 0 && index === 0 ? 'Executes immediately upon enrollment' :
                                 step.delay_days === 0 ? 'Executes immediately after previous step' :
                                 `Executes ${step.delay_days} day${step.delay_days !== 1 ? 's' : ''} after previous step`}
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
                    <div className="bg-green-50 border-2 border-green-500 rounded-xl p-5 min-w-[200px]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="font-semibold text-gray-900">Completed</div>
                      </div>
                      <div className="text-lg text-gray-600 mb-3">Workflow exits</div>
                      <div className="border-t border-gray-200 pt-3">
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>• Debtor marked as paid</div>
                          <div>• Debtor escalated</div>
                          <div>• Manual completion</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {(previewWorkflow.workflow_steps || []).length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <GitBranch className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Steps Defined</h3>
                    <p className="text-gray-600">This workflow doesn't have any steps configured yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WorkflowsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <WorkflowsContent />
      </AppLayout>
    </ProtectedRoute>
  )
} 