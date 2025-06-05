import { supabase } from './supabase'

/**
 * Workflow Execution Engine
 * 
 * This handles:
 * - Automated workflow execution based on cadences
 * - Multi-channel communication (email, SMS, physical mail)
 * - Workflow status management (stopping when marked paid/completed)
 * - Scheduling next steps based on delays
 */

export class WorkflowEngine {
  constructor() {
    this.isRunning = false
    this.intervalId = null
  }

  /**
   * Start the workflow engine
   * This runs continuously to check for pending executions
   */
  start(intervalMinutes = 5) {
    if (this.isRunning) return
    
    console.log('[WorkflowEngine] Starting workflow engine...')
    this.isRunning = true
    
    // Run immediately
    this.processWorkflows()
    
    // Then run every X minutes
    this.intervalId = setInterval(() => {
      this.processWorkflows()
    }, intervalMinutes * 60 * 1000)
  }

  /**
   * Stop the workflow engine
   */
  stop() {
    console.log('[WorkflowEngine] Stopping workflow engine...')
    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Process all pending workflow executions
   */
  async processWorkflows() {
    try {
      console.log('[WorkflowEngine] Processing workflows...')
      
      // Get all pending executions that are due
      const { data: pendingExecutions, error } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          debtor_workflows (
            id,
            debtor_id,
            workflow_id,
            status,
            current_step_number,
            debtors (
              id,
              name,
              email,
              phone,
              address,
              balance_cents,
              status
            )
          ),
          workflow_steps (
            id,
            step_type,
            template_id,
            templates (
              id,
              name,
              email_subject,
              html_content,
              sms_content,
              physical_content,
              channel
            )
          )
        `)
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .limit(50) // Process in batches

      if (error) {
        console.error('[WorkflowEngine] Error fetching pending executions:', error)
        return
      }

      console.log(`[WorkflowEngine] Found ${pendingExecutions?.length || 0} pending executions`)

      for (const execution of pendingExecutions || []) {
        await this.processExecution(execution)
      }

      // Schedule next steps for active workflows
      await this.scheduleNextSteps()

    } catch (error) {
      console.error('[WorkflowEngine] Error processing workflows:', error)
    }
  }

  /**
   * Process a single workflow execution
   */
  async processExecution(execution) {
    try {
      const debtorWorkflow = execution.debtor_workflows
      const workflowStep = execution.workflow_steps
      const debtor = debtorWorkflow.debtors
      const template = workflowStep.templates

      console.log(`[WorkflowEngine] Processing execution for debtor ${debtor.name} - Step ${execution.step_number}`)

      // Check if debtor workflow is still active
      if (debtorWorkflow.status !== 'active') {
        console.log(`[WorkflowEngine] Skipping - debtor workflow status is ${debtorWorkflow.status}`)
        await this.markExecutionSkipped(execution.id, 'Workflow not active')
        return
      }

      // Check if debtor is marked as paid/resolved
      if (debtor.status === 'paid' || debtor.status === 'resolved') {
        console.log(`[WorkflowEngine] Stopping workflow - debtor marked as ${debtor.status}`)
        await this.stopDebtorWorkflow(debtorWorkflow.id, 'completed')
        await this.markExecutionSkipped(execution.id, `Debtor marked as ${debtor.status}`)
        return
      }

      // Mark execution as executing
      await this.updateExecutionStatus(execution.id, 'executing')

      let result = null
      let letterId = null

      // Execute based on step type
      switch (workflowStep.step_type) {
        case 'email':
          result = await this.executeEmailStep(debtor, template)
          break
        case 'sms':
          result = await this.executeSMSStep(debtor, template)
          break
        case 'physical':
          result = await this.executePhysicalStep(debtor, template)
          break
        case 'wait':
          result = await this.executeWaitStep(debtor, workflowStep)
          break
        default:
          throw new Error(`Unknown step type: ${workflowStep.step_type}`)
      }

      if (result.success) {
        letterId = result.letterId
        console.log(`[WorkflowEngine] Step executed successfully for ${debtor.name}`)
        await this.markExecutionCompleted(execution.id, letterId)
        await this.updateDebtorWorkflowProgress(debtorWorkflow.id, execution.step_number)
      } else {
        console.error(`[WorkflowEngine] Step execution failed for ${debtor.name}:`, result.error)
        await this.markExecutionFailed(execution.id, result.error)
      }

    } catch (error) {
      console.error('[WorkflowEngine] Error processing execution:', error)
      await this.markExecutionFailed(execution.id, error.message)
    }
  }

  /**
   * Execute email step
   */
  async executeEmailStep(debtor, template) {
    try {
      if (!debtor.email) {
        return { success: false, error: 'No email address for debtor' }
      }

      if (!template || template.channel !== 'email') {
        return { success: false, error: 'Invalid email template' }
      }

      // Create letter record
      const { data: letter, error: letterError } = await supabase
        .from('letters')
        .insert({
          debtor_id: debtor.id,
          template_id: template.id,
          status: 'draft',
          channel: 'email'
        })
        .select()
        .single()

      if (letterError) throw letterError

      // Send email via API endpoint
      const emailResult = await this.sendEmailViaAPI({
        to: debtor.email,
        subject: this.personalizeContent(template.email_subject, debtor),
        html: this.personalizeContent(template.html_content, debtor),
        letterId: letter.id
      })

      if (emailResult.success) {
        // Update letter status
        await supabase
          .from('letters')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            sendgrid_message_id: emailResult.messageId 
          })
          .eq('id', letter.id)

        return { success: true, letterId: letter.id }
      } else {
        await supabase
          .from('letters')
          .update({ status: 'failed' })
          .eq('id', letter.id)

        return { success: false, error: emailResult.error }
      }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Send email via API endpoint
   */
  async sendEmailViaAPI({ to, subject, html, letterId }) {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, subject, html, letterId })
      })

      const result = await response.json()
      
      if (!response.ok) {
        return { success: false, error: result.error || 'Failed to send email' }
      }

      return result

    } catch (error) {
      console.error('[WorkflowEngine] Error calling email API:', error)
      return { success: false, error: 'Network error calling email API' }
    }
  }

  /**
   * Execute SMS step
   */
  async executeSMSStep(debtor, template) {
    try {
      if (!debtor.phone) {
        return { success: false, error: 'No phone number for debtor' }
      }

      if (!template || template.channel !== 'sms') {
        return { success: false, error: 'Invalid SMS template' }
      }

      // Create letter record
      const { data: letter, error: letterError } = await supabase
        .from('letters')
        .insert({
          debtor_id: debtor.id,
          template_id: template.id,
          status: 'draft',
          channel: 'sms'
        })
        .select()
        .single()

      if (letterError) throw letterError

      // TODO: Integrate with SMS provider (Twilio, etc.)
      // For now, we'll simulate SMS sending
      const smsContent = this.personalizeContent(template.sms_content, debtor)
      
      console.log(`[WorkflowEngine] Sending SMS to ${debtor.phone}: ${smsContent}`)
      
      // Simulate SMS sending delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Update letter status
      await supabase
        .from('letters')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString()
        })
        .eq('id', letter.id)

      return { success: true, letterId: letter.id }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Execute physical mail step
   */
  async executePhysicalStep(debtor, template) {
    try {
      if (!debtor.address) {
        return { success: false, error: 'No address for debtor' }
      }

      if (!template || template.channel !== 'physical') {
        return { success: false, error: 'Invalid physical mail template' }
      }

      // Create letter record
      const { data: letter, error: letterError } = await supabase
        .from('letters')
        .insert({
          debtor_id: debtor.id,
          template_id: template.id,
          status: 'draft',
          channel: 'physical'
        })
        .select()
        .single()

      if (letterError) throw letterError

      // TODO: Integrate with physical mail provider (Lob, PostGrid, etc.)
      // For now, we'll simulate physical mail preparation
      const physicalContent = this.personalizeContent(template.physical_content, debtor)
      
      console.log(`[WorkflowEngine] Preparing physical mail for ${debtor.address}: ${physicalContent.substring(0, 100)}...`)
      
      // Simulate mail preparation delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Update letter status
      await supabase
        .from('letters')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString()
        })
        .eq('id', letter.id)

      return { success: true, letterId: letter.id }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Execute wait step
   */
  async executeWaitStep(debtor, workflowStep) {
    try {
      console.log(`[WorkflowEngine] Wait step for ${debtor.name} - no action needed`)
      return { success: true, letterId: null }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Personalize content with debtor data
   */
  personalizeContent(content, debtor) {
    if (!content) return ''
    
    return content
      .replace(/{{name}}/g, debtor.name || '')
      .replace(/{{email}}/g, debtor.email || '')
      .replace(/{{phone}}/g, debtor.phone || '')
      .replace(/{{balance}}/g, (debtor.balance_cents / 100).toFixed(2))
      .replace(/{{address}}/g, debtor.address || '')
  }

  /**
   * Schedule next steps for active workflows
   */
  async scheduleNextSteps() {
    try {
      // Get active debtor workflows that need next steps scheduled
      const { data: activeWorkflows, error } = await supabase
        .from('debtor_workflows')
        .select(`
          *,
          workflows (
            id,
            workflow_steps (
              id,
              step_number,
              step_type,
              delay_days,
              delay_hours,
              template_id
            )
          )
        `)
        .eq('status', 'active')
        .is('next_action_at', null)

      if (error) {
        console.error('[WorkflowEngine] Error fetching active workflows:', error)
        return
      }

      for (const debtorWorkflow of activeWorkflows || []) {
        const workflow = debtorWorkflow.workflows
        const nextStep = workflow.workflow_steps?.find(
          step => step.step_number === debtorWorkflow.current_step_number + 1
        )

        if (nextStep) {
          // Calculate next execution time
          const nextActionAt = new Date()
          nextActionAt.setDate(nextActionAt.getDate() + (nextStep.delay_days || 0))
          nextActionAt.setHours(nextActionAt.getHours() + (nextStep.delay_hours || 0))

          // Update debtor workflow with next action time
          await supabase
            .from('debtor_workflows')
            .update({ next_action_at: nextActionAt.toISOString() })
            .eq('id', debtorWorkflow.id)

          // Create workflow execution record
          await supabase
            .from('workflow_executions')
            .insert({
              debtor_workflow_id: debtorWorkflow.id,
              workflow_step_id: nextStep.id,
              step_number: nextStep.step_number,
              status: 'pending',
              scheduled_at: nextActionAt.toISOString()
            })

          console.log(`[WorkflowEngine] Scheduled step ${nextStep.step_number} for debtor workflow ${debtorWorkflow.id}`)
        } else {
          // No more steps, complete the workflow
          await this.stopDebtorWorkflow(debtorWorkflow.id, 'completed')
          console.log(`[WorkflowEngine] Completed workflow for debtor workflow ${debtorWorkflow.id}`)
        }
      }

    } catch (error) {
      console.error('[WorkflowEngine] Error scheduling next steps:', error)
    }
  }

  /**
   * Helper methods for updating execution status
   */
  async updateExecutionStatus(executionId, status) {
    await supabase
      .from('workflow_executions')
      .update({ 
        status,
        executed_at: status === 'executing' ? new Date().toISOString() : null
      })
      .eq('id', executionId)
  }

  async markExecutionCompleted(executionId, letterId = null) {
    await supabase
      .from('workflow_executions')
      .update({ 
        status: 'completed',
        executed_at: new Date().toISOString(),
        letter_id: letterId
      })
      .eq('id', executionId)
  }

  async markExecutionFailed(executionId, errorMessage) {
    await supabase
      .from('workflow_executions')
      .update({ 
        status: 'failed',
        executed_at: new Date().toISOString(),
        error_message: errorMessage
      })
      .eq('id', executionId)
  }

  async markExecutionSkipped(executionId, reason) {
    await supabase
      .from('workflow_executions')
      .update({ 
        status: 'skipped',
        executed_at: new Date().toISOString(),
        error_message: reason
      })
      .eq('id', executionId)
  }

  async updateDebtorWorkflowProgress(debtorWorkflowId, completedStepNumber) {
    await supabase
      .from('debtor_workflows')
      .update({ 
        current_step_number: completedStepNumber,
        next_action_at: null // Will be set when next step is scheduled
      })
      .eq('id', debtorWorkflowId)
  }

  async stopDebtorWorkflow(debtorWorkflowId, status = 'completed') {
    await supabase
      .from('debtor_workflows')
      .update({ 
        status,
        completed_at: new Date().toISOString(),
        next_action_at: null
      })
      .eq('id', debtorWorkflowId)

    // Cancel any pending executions
    await supabase
      .from('workflow_executions')
      .update({ status: 'skipped', error_message: `Workflow ${status}` })
      .eq('debtor_workflow_id', debtorWorkflowId)
      .eq('status', 'pending')
  }
}

/**
 * Workflow Management Functions
 * These are called from the UI to start/stop workflows for debtors
 */

/**
 * Start a workflow for a debtor
 */
export async function startWorkflowForDebtor(debtorId, workflowId) {
  try {
    console.log(`[WorkflowEngine] Starting workflow ${workflowId} for debtor ${debtorId}`)

    // Check if debtor already has an active workflow
    const { data: existing } = await supabase
      .from('debtor_workflows')
      .select('id')
      .eq('debtor_id', debtorId)
      .eq('status', 'active')
      .single()

    if (existing) {
      throw new Error('Debtor already has an active workflow')
    }

    // Get the workflow and its first step
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select(`
        *,
        workflow_steps (
          id,
          step_number,
          step_type,
          delay_days,
          delay_hours,
          template_id
        )
      `)
      .eq('id', workflowId)
      .single()

    if (workflowError) throw workflowError

    const firstStep = workflow.workflow_steps?.find(step => step.step_number === 1)
    if (!firstStep) {
      throw new Error('Workflow has no steps')
    }

    // Create debtor workflow
    const { data: debtorWorkflow, error: dwError } = await supabase
      .from('debtor_workflows')
      .insert({
        debtor_id: debtorId,
        workflow_id: workflowId,
        current_step_number: 0,
        status: 'active',
        started_at: new Date().toISOString(),
        next_action_at: new Date().toISOString() // First step executes immediately
      })
      .select()
      .single()

    if (dwError) throw dwError

    // Create first execution
    await supabase
      .from('workflow_executions')
      .insert({
        debtor_workflow_id: debtorWorkflow.id,
        workflow_step_id: firstStep.id,
        step_number: firstStep.step_number,
        status: 'pending',
        scheduled_at: new Date().toISOString()
      })

    console.log(`[WorkflowEngine] Workflow started successfully for debtor ${debtorId}`)
    return { success: true, debtorWorkflowId: debtorWorkflow.id }

  } catch (error) {
    console.error('[WorkflowEngine] Error starting workflow:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Stop a workflow for a debtor
 */
export async function stopWorkflowForDebtor(debtorId, reason = 'manual_stop') {
  try {
    console.log(`[WorkflowEngine] Stopping workflow for debtor ${debtorId}`)

    // Find active workflow for debtor
    const { data: debtorWorkflow } = await supabase
      .from('debtor_workflows')
      .select('id')
      .eq('debtor_id', debtorId)
      .eq('status', 'active')
      .single()

    if (debtorWorkflow) {
      const engine = new WorkflowEngine()
      await engine.stopDebtorWorkflow(debtorWorkflow.id, reason)
      console.log(`[WorkflowEngine] Workflow stopped for debtor ${debtorId}`)
    }

    return { success: true }

  } catch (error) {
    console.error('[WorkflowEngine] Error stopping workflow:', error)
    return { success: false, error: error.message }
  }
}

// Create singleton instance
export const workflowEngine = new WorkflowEngine() 