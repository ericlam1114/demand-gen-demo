import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import sgMail from '@sendgrid/mail'
import Handlebars from 'handlebars'
import { v4 as uuidv4 } from 'uuid'
import { hasFeature } from '@/lib/plan-restrictions'

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function POST(request) {
  try {
    const supabase = createServerClient()
    const now = new Date()
    
    console.log('Executing workflows at:', now.toISOString())

    // Get company settings first
    const { data: companySettings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single()

    if (settingsError) {
      console.error('No company settings found:', settingsError)
      // Use defaults if no settings found
    }

    // Find debtor workflows that need action
    const { data: readyWorkflows, error: queryError } = await supabase
      .from('debtor_workflows')
      .select(`
        id,
        debtor_id,
        workflow_id,
        current_step_number,
        next_action_at,
        debtors (
          name,
          email,
          balance_cents,
          state,
          phone,
          address,
          city,
          zip,
          country,
          account_number,
          original_creditor,
          notes,
          agency_id,
          agencies (
            plan
          )
        ),
        workflows (
          name
        )
      `)
      .eq('status', 'active')
      .lte('next_action_at', now.toISOString())

    if (queryError) {
      console.error('Error querying workflows:', queryError)
      return NextResponse.json({ error: 'Failed to query workflows' }, { status: 500 })
    }

    if (!readyWorkflows || readyWorkflows.length === 0) {
      return NextResponse.json({ 
        success: true, 
        executed: 0, 
        message: 'No workflows ready for execution' 
      })
    }

    let executed = 0
    const errors = []

    for (const workflow of readyWorkflows) {
      try {
        // Check plan restrictions
        const agencyPlan = workflow.debtors.agencies?.plan || 'free'
        
        // Get the current workflow step
        const { data: step, error: stepError } = await supabase
          .from('workflow_steps')
          .select(`
            *,
            templates (
              id,
              name,
              html_content,
              email_subject,
              sms_content,
              physical_body
            )
          `)
          .eq('workflow_id', workflow.workflow_id)
          .eq('step_number', workflow.current_step_number)
          .single()

        if (stepError || !step) {
          console.error(`No step found for workflow ${workflow.id}:`, stepError)
          console.error(`Workflow details: workflow_id=${workflow.workflow_id}, current_step_number=${workflow.current_step_number}`)
          
          // Check if this workflow has any steps at all
          const { data: allSteps, error: allStepsError } = await supabase
            .from('workflow_steps')
            .select('id, step_number')
            .eq('workflow_id', workflow.workflow_id)
            .order('step_number', { ascending: true })

          if (allStepsError || !allSteps || allSteps.length === 0) {
            console.error(`Workflow ${workflow.workflow_id} has no steps configured. Marking as completed.`)
            
            // Mark workflow as completed since it has no steps
            await supabase
              .from('debtor_workflows')
              .update({
                status: 'completed',
                completed_at: now.toISOString(),
                metadata: { error: 'No workflow steps configured' }
              })
              .eq('id', workflow.id)
            
            errors.push(`Workflow ${workflow.id}: No steps configured`)
            continue
          }
          
          // If there are steps but current step not found, reset to first step
          console.log(`Resetting workflow ${workflow.id} to first step`)
          await supabase
            .from('debtor_workflows')
            .update({
              current_step_number: 1,
              next_action_at: now.toISOString()
            })
            .eq('id', workflow.id)
          
          continue
        }

        // Check if this step type is allowed for the agency's plan
        if ((step.step_type === 'sms' && !hasFeature(agencyPlan, 'sms')) ||
            (step.step_type === 'wait' && !hasFeature(agencyPlan, 'workflows'))) {
          console.log(`Skipping step ${step.step_type} - not available in ${agencyPlan} plan`)
          // Skip to next step or complete workflow
          await skipStep(supabase, workflow, step, now)
          continue
        }

        // Execute step based on type
        if (step.step_type === 'email' && step.templates) {
          await executeEmailStep(supabase, workflow, step, companySettings, now)
          executed++
        } else if (step.step_type === 'sms' && step.templates) {
          await executeSmsStep(supabase, workflow, step, companySettings, now)
          executed++
        } else if (step.step_type === 'physical' && step.templates) {
          await executePhysicalStep(supabase, workflow, step, companySettings, now)
          executed++
        } else if (step.step_type === 'wait') {
          console.log(`Wait step executed for workflow ${workflow.id}`)
          executed++
        }

        // Calculate and schedule next step
        await scheduleNextStep(supabase, workflow, now)

      } catch (error) {
        console.error(`Error executing workflow ${workflow.id}:`, error)
        errors.push(`Workflow ${workflow.id}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      executed,
      errors: errors.length > 0 ? errors : undefined,
      message: `Executed ${executed} workflow steps successfully`
    })

  } catch (error) {
    console.error('Workflow execution error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Helper function to skip a step (for plan restrictions)
async function skipStep(supabase, workflow, step, now) {
  await supabase
    .from('workflow_executions')
    .insert({
      debtor_workflow_id: workflow.id,
      step_id: step.id,
      execution_type: step.step_type,
      executed_at: now.toISOString(),
      status: 'skipped',
      error_message: 'Step type not available in current plan'
    })
  
  await scheduleNextStep(supabase, workflow, now)
}

// Execute email step
async function executeEmailStep(supabase, workflow, step, companySettings, now) {
  const templateData = getTemplateData(workflow, companySettings, step)

          // Compile and render template
          const subjectTemplate = Handlebars.compile(step.templates.email_subject || 'Demand for Payment - {{debtor_name}}')
          const bodyTemplate = Handlebars.compile(step.templates.html_content)
          
          const subject = subjectTemplate(templateData)
          const htmlContent = bodyTemplate(templateData)
          
  // Generate unique reference for SendGrid tracking correlation
          const trackingId = uuidv4()

  // Prepare email with SendGrid native tracking
          const msg = {
            to: workflow.debtors.email,
            from: {
              email: companySettings?.from_email || process.env.FROM_EMAIL || 'collections@example.com',
              name: companySettings?.from_name || companySettings?.company_name || 'Collections Agency'
            },
            replyTo: companySettings?.reply_to_email || companySettings?.company_email,
            subject: subject,
    html: htmlContent, // Use clean HTML without custom tracking pixel
    // Custom args for correlation with SendGrid webhooks
    customArgs: {
      letter_id: trackingId,
      debtor_id: workflow.debtor_id.toString(),
      workflow_id: workflow.workflow_id.toString(),
      step_number: workflow.current_step_number.toString()
    },
    // Enhanced SendGrid tracking settings
            trackingSettings: {
              clickTracking: {
        enable: true,
        enableText: true // Track clicks in plain text emails too
              },
              openTracking: {
        enable: true,
        substitutionTag: '%open_track%' // Optional: custom substitution tag
      },
      subscriptionTracking: {
        enable: false // Disable for demand letters
      },
      ganalytics: {
        enable: true,
        utmSource: 'demand-letters',
        utmMedium: 'email',
        utmCampaign: 'collections-workflow'
              }
    },
    // Categories for SendGrid analytics
    categories: ['demand-letter', 'workflow', `step-${workflow.current_step_number}`]
          }

          // Send email
          await sgMail.send(msg)
          console.log(`Email sent to ${workflow.debtors.email} for step ${workflow.current_step_number}`)

  // Record the letter with SendGrid tracking reference
  const { data: letter } = await supabase
            .from('letters')
            .insert({
              debtor_id: workflow.debtor_id,
              template_id: step.templates.id,
      channel: 'email',
              status: 'sent',
              sent_at: now.toISOString(),
      tracking_id: trackingId, // This will correlate with SendGrid webhook events
      sendgrid_message_id: null, // Will be updated via webhook
      email_events: [] // Array to store SendGrid events
            })
            .select()
            .single()

          // Record the execution
          await supabase
            .from('workflow_executions')
            .insert({
              debtor_workflow_id: workflow.id,
              step_id: step.id,
              execution_type: 'email',
              executed_at: now.toISOString(),
              status: 'completed',
              letter_id: letter?.id
            })
        }

// Execute SMS step
async function executeSmsStep(supabase, workflow, step, companySettings, now) {
  if (!workflow.debtors.phone) {
    throw new Error('No phone number available for SMS')
  }

  const templateData = getTemplateData(workflow, companySettings, step)
  const smsTemplate = Handlebars.compile(step.templates.sms_content || 'Payment reminder: {{debtor_name}}, please contact us regarding your account balance of ${{balance_amount}}.')
  const smsContent = smsTemplate(templateData)

  // Mock SMS sending - replace with actual SMS service (Twilio, etc.)
  console.log(`SMS would be sent to ${workflow.debtors.phone}: ${smsContent}`)
  
  // In production, integrate with SMS service:
  // await twilioClient.messages.create({
  //   body: smsContent,
  //   from: companySettings?.sms_phone || process.env.TWILIO_PHONE,
  //   to: workflow.debtors.phone
  // })

  // Record the letter
  const { data: letter } = await supabase
    .from('letters')
    .insert({
      debtor_id: workflow.debtor_id,
      template_id: step.templates.id,
      channel: 'sms',
      status: 'sent',
      sent_at: now.toISOString()
    })
    .select()
    .single()

  // Record the execution
  await supabase
    .from('workflow_executions')
    .insert({
      debtor_workflow_id: workflow.id,
      step_id: step.id,
      execution_type: 'sms',
      executed_at: now.toISOString(),
      status: 'completed',
      letter_id: letter?.id
    })
}

// Execute physical mail step
async function executePhysicalStep(supabase, workflow, step, companySettings, now) {
  try {
    // Validate debtor has address information
    if (!workflow.debtors.address || !workflow.debtors.city || !workflow.debtors.state || !workflow.debtors.zip) {
      throw new Error('Debtor address information is incomplete for physical mail')
    }

    // Call the physical mail API
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const response = await fetch(`${siteUrl}/api/send-physical-mail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        debtor_id: workflow.debtor_id,
        template_id: step.templates.id,
        company_settings: companySettings
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Physical mail API error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`Failed to send physical mail: ${response.statusText}`)
    }

    const result = await response.json()
    console.log(`Physical mail sent via Lob: ${result.lob_letter_id}`)

    // Record the execution
    await supabase
      .from('workflow_executions')
      .insert({
        debtor_workflow_id: workflow.id,
        step_id: step.id,
        execution_type: 'physical',
        executed_at: now.toISOString(),
        status: 'completed',
        letter_id: result.letter_id
      })
  } catch (error) {
    console.error(`Error in physical mail step: ${error.message}`)
    throw error
  }
}

// Schedule next step in workflow
async function scheduleNextStep(supabase, workflow, now) {
        const { data: nextStep } = await supabase
          .from('workflow_steps')
          .select('step_number, delay_days, delay_hours')
          .eq('workflow_id', workflow.workflow_id)
          .gt('step_number', workflow.current_step_number)
          .order('step_number', { ascending: true })
          .limit(1)
          .single()

        if (nextStep) {
          // Schedule next step
          const nextActionTime = new Date(now)
          nextActionTime.setDate(nextActionTime.getDate() + (nextStep.delay_days || 0))
          nextActionTime.setHours(nextActionTime.getHours() + (nextStep.delay_hours || 0))

          await supabase
            .from('debtor_workflows')
            .update({
              current_step_number: nextStep.step_number,
              next_action_at: nextActionTime.toISOString()
            })
            .eq('id', workflow.id)
        } else {
          // Workflow completed
          await supabase
            .from('debtor_workflows')
            .update({
              status: 'completed',
              completed_at: now.toISOString()
            })
            .eq('id', workflow.id)
        }
}

// Get template data for rendering
function getTemplateData(workflow, companySettings, step) {
  return {
    // Debtor information
    debtor_name: workflow.debtors.name,
    debtor_email: workflow.debtors.email,
    balance_amount: (workflow.debtors.balance_cents / 100).toFixed(2),
    balance_cents: workflow.debtors.balance_cents,
    state: workflow.debtors.state,
    phone: workflow.debtors.phone,
    address: workflow.debtors.address,
    city: workflow.debtors.city,
    zip: workflow.debtors.zip,
    country: workflow.debtors.country,
    account_number: workflow.debtors.account_number,
    original_creditor: workflow.debtors.original_creditor,
    notes: workflow.debtors.notes,
    
    // Company information
    company_name: companySettings?.company_name || 'Collections Agency',
    company_address: companySettings?.company_address || '',
    company_city: companySettings?.company_city || '',
    company_state: companySettings?.company_state || '',
    company_zip: companySettings?.company_zip || '',
    company_phone: companySettings?.company_phone || '',
    company_email: companySettings?.company_email || '',
    company_website: companySettings?.company_website || '',
    license_number: companySettings?.license_number || '',
    
    // Legal and compliance
    letter_footer: companySettings?.letter_footer || 'This communication is from a debt collector.',
    legal_disclaimer: companySettings?.legal_disclaimer || 'Unless you notify this office within 30 days after receiving this notice that you dispute the validity of this debt or any portion thereof, this office will assume this debt is valid.',
    
    // System variables
    current_date: new Date().toLocaleDateString(),
    step_number: workflow.current_step_number,
    workflow_name: workflow.workflows.name
  }
} 