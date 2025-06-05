'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { workflowEngine, startWorkflowForDebtor, stopWorkflowForDebtor } from '@/lib/workflow-engine'
import { supabase } from '@/lib/supabase'
import { Play, Pause, Square, RefreshCw, Users, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

function WorkflowEngineContent() {
  const [engineStatus, setEngineStatus] = useState(false)
  const [executions, setExecutions] = useState([])
  const [debtorWorkflows, setDebtorWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchData()
    setEngineStatus(workflowEngine.isRunning)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch recent executions
      const { data: executionsData } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          debtor_workflows (
            debtors (
              name,
              email
            )
          ),
          workflow_steps (
            step_type,
            templates (
              name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      // Fetch active debtor workflows
      const { data: workflowsData } = await supabase
        .from('debtor_workflows')
        .select(`
          *,
          debtors (
            name,
            email,
            status
          ),
          workflows (
            name
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      setExecutions(executionsData || [])
      setDebtorWorkflows(workflowsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load workflow data')
    } finally {
      setLoading(false)
    }
  }

  const startEngine = () => {
    workflowEngine.start(1) // Check every minute for demo
    setEngineStatus(true)
    toast.success('Workflow engine started')
  }

  const stopEngine = () => {
    workflowEngine.stop()
    setEngineStatus(false)
    toast.success('Workflow engine stopped')
  }

  const processNow = async () => {
    setProcessing(true)
    try {
      await workflowEngine.processWorkflows()
      toast.success('Workflows processed manually')
      await fetchData()
    } catch (error) {
      console.error('Error processing workflows:', error)
      toast.error('Failed to process workflows')
    } finally {
      setProcessing(false)
    }
  }

  const stopDebtorWorkflow = async (debtorId, debtorName) => {
    if (!confirm(`Stop workflow for ${debtorName}?`)) return

    try {
      const result = await stopWorkflowForDebtor(debtorId, 'manual_stop')
      if (result.success) {
        toast.success(`Workflow stopped for ${debtorName}`)
        await fetchData()
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error('Error stopping workflow:', error)
      toast.error('Failed to stop workflow')
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'executing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-gray-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workflow Engine Admin</h1>
          <p className="mt-2 text-gray-600">Monitor and control automated workflow executions</p>
        </div>

        {/* Engine Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Engine Status</h2>
              <p className="text-sm text-gray-500 mt-1">
                {engineStatus ? 'Running - checking for workflows every minute' : 'Stopped'}
              </p>
            </div>
            <div className="flex space-x-3">
              <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
                engineStatus 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {engineStatus ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    Running
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                    Stopped
                  </>
                )}
              </div>
              {engineStatus ? (
                <Button variant="outline" onClick={stopEngine}>
                  <Pause className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button onClick={startEngine}>
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </Button>
              )}
              <Button variant="outline" onClick={processNow} disabled={processing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
                Process Now
              </Button>
              <Button variant="outline" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Workflows */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Active Debtor Workflows</h3>
                <div className="flex items-center text-sm text-gray-500">
                  <Users className="w-4 h-4 mr-1" />
                  {debtorWorkflows.length}
                </div>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-gray-500">Loading...</div>
              ) : debtorWorkflows.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No active workflows</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {debtorWorkflows.map((workflow) => (
                    <div key={workflow.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {workflow.debtors.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {workflow.workflows.name} • Step {workflow.current_step_number}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Next: {workflow.next_action_at ? formatDate(workflow.next_action_at) : 'Not scheduled'}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            workflow.debtors.status === 'paid' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {workflow.debtors.status || 'active'}
                          </span>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => stopDebtorWorkflow(workflow.debtor_id, workflow.debtors.name)}
                          >
                            <Square className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Executions */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Executions</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-gray-500">Loading...</div>
              ) : executions.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No executions yet</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {executions.map((execution) => (
                    <div key={execution.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(execution.status)}
                          <div>
                            <div className="font-medium text-gray-900">
                              Step {execution.step_number}: {execution.workflow_steps.step_type}
                            </div>
                            <div className="text-sm text-gray-500">
                              {execution.debtor_workflows.debtors.name}
                            </div>
                            {execution.workflow_steps.templates && (
                              <div className="text-xs text-gray-400">
                                Template: {execution.workflow_steps.templates.name}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${
                            execution.status === 'completed' ? 'text-green-600' :
                            execution.status === 'failed' ? 'text-red-600' :
                            execution.status === 'pending' ? 'text-yellow-600' :
                            'text-gray-600'
                          }`}>
                            {execution.status}
                          </div>
                          <div className="text-xs text-gray-500">
                            {execution.executed_at ? formatDate(execution.executed_at) : 
                             execution.scheduled_at ? `Scheduled: ${formatDate(execution.scheduled_at)}` :
                             'Not scheduled'}
                          </div>
                          {execution.error_message && (
                            <div className="text-xs text-red-500 mt-1 max-w-32 truncate">
                              {execution.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-4">Quick Actions</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Start Engine:</strong> Begin automatic workflow processing</p>
            <p>• <strong>Process Now:</strong> Manually trigger workflow execution check</p>
            <p>• <strong>Stop Workflow:</strong> Halt workflow for specific debtor (e.g., when marked as paid)</p>
            <p>• <strong>Engine checks every minute</strong> for pending executions when running</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WorkflowEngineAdminPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <WorkflowEngineContent />
      </AppLayout>
    </ProtectedRoute>
  )
} 