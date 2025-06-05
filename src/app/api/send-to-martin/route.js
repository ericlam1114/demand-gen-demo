import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sgMail from '@sendgrid/mail'
import Handlebars from 'handlebars'

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Get Martin's data
    const { data: debtor } = await supabase
      .from('debtors')
      .select('*')
      .eq('email', 'ericlam1114@gmail.com')
      .eq('name', 'Martin Goldsled')
      .single()

    if (!debtor) {
      return NextResponse.json({ error: 'Martin not found' }, { status: 404 })
    }

    // Get the template
    const { data: template } = await supabase
      .from('templates')
      .select('*')
      .eq('name', 'Default Demand Letter')
      .single()

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Prepare template data
    const templateData = {
      name: debtor.name,
      balance: (debtor.balance_cents / 100).toFixed(2),
      state: debtor.state,
      tracking_pixel_url: '#' // Placeholder since we're using SendGrid tracking
    }

    // Compile templates
    const subjectTemplate = Handlebars.compile(template.email_subject)
    const bodyTemplate = Handlebars.compile(template.html_content)
    
    const subject = subjectTemplate(templateData)
    const htmlContent = bodyTemplate(templateData)

    // Send email
    const msg = {
      to: debtor.email,
      from: {
        email: 'eric@datasynthetix.com', // Using verified sender
        name: 'Nexum Collections'
      },
      subject: subject,
      html: htmlContent,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
        subscriptionTracking: { enable: false }
      }
    }

    const result = await sgMail.send(msg)
    console.log('Email sent to Martin:', result)

    // Update the letter status
    const { error: updateError } = await supabase
      .from('letters')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('debtor_id', debtor.id)
      .order('created_at', { ascending: false })
      .limit(1)

    return NextResponse.json({
      success: true,
      message: 'Email sent to Martin successfully',
      to: debtor.email,
      subject: subject,
      messageId: result[0].headers['x-message-id']
    })

  } catch (error) {
    console.error('Send to Martin error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send email', 
        details: error.message,
        response: error.response?.body
      },
      { status: 500 }
    )
  }
} 