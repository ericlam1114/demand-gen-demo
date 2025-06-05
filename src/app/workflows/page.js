'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/components/auth/AuthProvider'
import { PlanRestrictionBanner, PlanFeatureLock } from '@/components/ui/plan-restriction-banner'
import { hasFeature, getAllowedStepTypes, getUpgradeMessage } from '@/lib/plan-restrictions'
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
  Crown
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
  const { profile } = useAuth()
  const agency = profile?.agencies
  const currentPlan = agency?.plan || 'free'
  
  const [workflows, setWorkflows] = useState([])
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)
  const [workflowSteps, setWorkflowSteps] = useState([])
  const [templates, setTemplates] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showStepConfig, setShowStepConfig] = useState(null)

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

  useEffect(() => {
    fetchWorkflows()
    fetchTemplates()
  }, [])

  const fetchWorkflows = async () => {
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
              subject
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.log('Workflows query error:', error)
        // Handle RLS issues gracefully
        setWorkflows([])
        return
      }

      setWorkflows(data || [])
      
      if (data && data.length > 0 && !selectedWorkflow) {
        selectWorkflow(data[0])
      }
    } catch (error) {
      console.error('Error fetching workflows:', error)
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
      is_default: false,
      is_active: true
    })
    setIsEditing(true)
  }

  const saveWorkflow = async () => {
    if (!workflowForm.name.trim()) {
      toast.error('Please provide a workflow name')
      return
    }

    if (workflowSteps.length === 0) {
      toast.error('Please add at least one step to the workflow')
      return
    }

    setIsSaving(true)
    try {
      let workflowId = selectedWorkflow?.id

      if (selectedWorkflow) {
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
          .eq('id', selectedWorkflow.id)

        if (workflowError) throw workflowError

        // Clear existing steps
        await supabase
          .from('workflow_steps')
          .delete()
          .eq('workflow_id', selectedWorkflow.id)
      } else {
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

        if (workflowError) throw workflowError
        workflowId = newWorkflow.id
      }

      // If this workflow is set as default, remove default from others
      if (workflowForm.is_default) {
        await supabase
          .from('workflows')
          .update({ is_default: false })
          .neq('id', workflowId)
      }

      // Insert workflow steps
      const stepsToInsert = workflowSteps.map((step, index) => ({
        workflow_id: workflowId,
        step_number: index + 1,
        step_type: step.step_type,
        delay_days: step.delay_days || 0,
        delay_hours: step.delay_hours || 0,
        template_id: step.template_id
      }))

      const { error: stepsError } = await supabase
        .from('workflow_steps')
        .insert(stepsToInsert)

      if (stepsError) throw stepsError

      toast.success(selectedWorkflow ? 'Workflow updated successfully' : 'Workflow created successfully')
      fetchWorkflows()
      setIsEditing(false)
    } catch (error) {
      console.error('Error saving workflow:', error)
      toast.error('Failed to save workflow')
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
    setWorkflowSteps(updated)
  }

  const removeStep = (index) => {
    const updated = workflowSteps.filter((_, i) => i !== index)
    // Renumber steps
    const renumbered = updated.map((step, i) => ({ ...step, step_number: i + 1 }))
    setWorkflowSteps(renumbered)
  }

  const toggleDefault = async (workflowId) => {
    try {
      // First, remove default from all workflows
      await supabase
        .from('workflows')
        .update({ is_default: false })
        .neq('id', '')

      // Then set this one as default
      const { error } = await supabase
        .from('workflows')
        .update({ is_default: true })
        .eq('id', workflowId)

      if (error) throw error

      toast.success('Default workflow updated')
      fetchWorkflows()
    } catch (error) {
      console.error('Error updating default workflow:', error)
      toast.error('Failed to update default workflow')
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workflow Builder</h1>
          <p className="mt-2 text-gray-600">Create and manage automated demand letter workflows</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Workflow List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Workflows</h3>
                  {workflowsEnabled ? (
                    <Button size="sm" onClick={createNewWorkflow}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button size="sm" disabled className="opacity-50 cursor-not-allowed">
                      <Crown className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-2">
                {workflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className={`group relative p-3 rounded-md transition-colors cursor-pointer ${
                      selectedWorkflow?.id === workflow.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100'
                    } ${!workflowsEnabled ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => workflowsEnabled && selectWorkflow(workflow)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{workflow.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {workflow.workflow_steps?.length || 0} steps
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (workflowsEnabled) {
                            toggleDefault(workflow.id)
                          }
                        }}
                        className={`ml-2 p-1 rounded ${
                          workflow.is_default
                            ? 'text-yellow-500 hover:text-yellow-600'
                            : 'text-gray-400 hover:text-gray-600'
                        } ${!workflowsEnabled ? 'pointer-events-none' : ''}`}
                        title={workflow.is_default ? 'Default workflow' : 'Set as default'}
                        disabled={!workflowsEnabled}
                      >
                        {workflow.is_default ? (
                          <Star className="w-4 h-4 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {workflow.is_default && (
                      <div className="text-xs text-yellow-600 mt-1 font-medium">
                        DEFAULT
                      </div>
                    )}
                  </div>
                ))}
                {workflows.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No workflows yet</p>
                    <p className="text-xs mt-1">
                      {workflowsEnabled ? 'Create your first workflow' : 'Upgrade to create workflows'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Workflow Editor */}
          <div className="lg:col-span-3">
            {!workflowsEnabled ? (
              <PlanFeatureLock
                planName={currentPlan}
                featureName="workflows"
                upgradeMessage={getUpgradeMessage(currentPlan, 'workflows')}
              >
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Workflow Builder</h3>
                  <p className="text-gray-500 mb-6">Create automated workflows with multiple steps and follow-ups.</p>
                </div>
              </PlanFeatureLock>
            ) : selectedWorkflow || isEditing ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={workflowForm.name}
                          onChange={(e) => setWorkflowForm(prev => ({ ...prev, name: e.target.value }))}
                          className="text-lg font-medium text-gray-900 bg-transparent border-none p-0 focus:ring-0 w-full"
                          placeholder="Workflow name"
                        />
                      ) : (
                        <h3 className="text-lg font-medium text-gray-900">{selectedWorkflow?.name}</h3>
                      )}
                      {isEditing ? (
                        <textarea
                          value={workflowForm.description}
                          onChange={(e) => setWorkflowForm(prev => ({ ...prev, description: e.target.value }))}
                          className="text-sm text-gray-500 mt-1 bg-transparent border-none p-0 focus:ring-0 w-full resize-none"
                          placeholder="Workflow description"
                          rows={2}
                        />
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">
                          {selectedWorkflow?.description || 'No description provided'}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2 ml-4">
                      {isEditing ? (
                        <>
                          <Button variant="outline" onClick={() => setIsEditing(false)}>
                            Cancel
                          </Button>
                          <Button onClick={saveWorkflow} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                          <Edit3 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={workflowForm.is_default}
                          onChange={(e) => setWorkflowForm(prev => ({ ...prev, is_default: e.target.checked }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Set as default workflow</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={workflowForm.is_active}
                          onChange={(e) => setWorkflowForm(prev => ({ ...prev, is_active: e.target.checked }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Active</span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-md font-medium text-gray-900">Workflow Steps</h4>
                    {isEditing && (
                      <Button size="sm" onClick={addStep}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Step
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {workflowSteps.map((step, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 flex items-center gap-2">
                                Step {index + 1}: {WORKFLOW_STEPS.find(s => s.id === step.step_type)?.name || step.step_type}
                                {!allowedStepTypes.includes(step.step_type) && (
                                  <Crown className="w-4 h-4 text-amber-600" title="Upgrade required for this step type" />
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                {index === 0 ? 'Executes immediately' : `Executes ${step.delay_days} days${step.delay_hours ? ` ${step.delay_hours} hours` : ''} after previous step`}
                              </div>
                            </div>
                          </div>
                          {isEditing && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeStep(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {isEditing && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Action Type
                              </label>
                              <select
                                value={step.step_type}
                                onChange={(e) => updateStep(index, 'step_type', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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

                            {index > 0 && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Delay (Days)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={step.delay_days || 0}
                                  onChange={(e) => updateStep(index, 'delay_days', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            )}

                            {step.step_type !== 'wait' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Template
                                </label>
                                <select
                                  value={step.template_id || ''}
                                  onChange={(e) => updateStep(index, 'template_id', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">Select template</option>
                                  {templates.map(template => (
                                    <option key={template.id} value={template.id}>
                                      {template.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}

                        {!isEditing && step.template_id && (
                          <div className="mt-2 text-sm text-gray-600">
                            Template: {templates.find(t => t.id === step.template_id)?.name || 'Unknown'}
                          </div>
                        )}
                      </div>
                    ))}

                    {workflowSteps.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>No steps defined</p>
                        {isEditing && (
                          <Button className="mt-2" onClick={addStep}>
                            Add First Step
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-4">No Workflow Selected</h3>
                <p className="text-gray-500 mb-6">Select a workflow from the list or create a new one to get started.</p>
                <Button onClick={createNewWorkflow}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Workflow
                </Button>
              </div>
            )}
          </div>
        </div>
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