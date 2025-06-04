import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import sgMail from '@sendgrid/mail'
import Handlebars from 'handlebars'
import { v4 as uuidv4 } from 'uuid'

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
          notes
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
        // Get the current workflow step
        const { data: step, error: stepError } = await supabase
          .from('workflow_steps')
          .select(`
            *,
            templates (
              id,
              name,
              html_content,
              email_subject
            )
          `)
          .eq('workflow_id', workflow.workflow_id)
          .eq('step_number', workflow.current_step_number)
          .single()

        if (stepError || !step) {
          console.error(`No step found for workflow ${workflow.id}:`, stepError)
          continue
        }

        if (step.step_type === 'email' && step.templates) {
          // Prepare template data with company settings
          const templateData = {
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

          // Compile and render template
          const subjectTemplate = Handlebars.compile(step.templates.email_subject || 'Demand for Payment - {{debtor_name}}')
          const bodyTemplate = Handlebars.compile(step.templates.html_content)
          
          const subject = subjectTemplate(templateData)
          const htmlContent = bodyTemplate(templateData)
          
          // Generate tracking pixel
          const trackingId = uuidv4()
          const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_SITE_URL}/api/open?id=${trackingId}" width="1" height="1" style="display:none;" />`
          const finalHtml = htmlContent + trackingPixel

          // Prepare email with company settings
          const msg = {
            to: workflow.debtors.email,
            from: {
              email: companySettings?.from_email || process.env.FROM_EMAIL || 'collections@example.com',
              name: companySettings?.from_name || companySettings?.company_name || 'Collections Agency'
            },
            replyTo: companySettings?.reply_to_email || companySettings?.company_email,
            subject: subject,
            html: finalHtml,
            trackingSettings: {
              clickTracking: {
                enable: true
              },
              openTracking: {
                enable: true
              }
            }
          }

          // Send email
          await sgMail.send(msg)
          console.log(`Email sent to ${workflow.debtors.email} for step ${workflow.current_step_number}`)

          // Record the letter
          const { data: letter, error: letterError } = await supabase
            .from('letters')
            .insert({
              debtor_id: workflow.debtor_id,
              template_id: step.templates.id,
              status: 'sent',
              sent_at: now.toISOString(),
              tracking_id: trackingId
            })
            .select()
            .single()

          if (letterError) {
            console.error('Error recording letter:', letterError)
          }

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

        // Calculate next step
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

        executed++
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