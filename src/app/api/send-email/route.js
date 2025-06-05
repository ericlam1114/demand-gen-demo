import sgMail from '@sendgrid/mail'
import { createServerClient } from '@/lib/supabase'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

export async function POST(request) {
  try {
    const { to, subject, html, letterId } = await request.json()

    if (!process.env.SENDGRID_API_KEY) {
      return Response.json({ 
        success: false, 
        error: 'SendGrid API key not configured' 
      }, { status: 500 })
    }

    if (!to || !subject || !html) {
      return Response.json({ 
        success: false, 
        error: 'Missing required fields: to, subject, html' 
      }, { status: 400 })
    }

    // Generate unique tracking ID
    const trackingId = `letter_${letterId}_${Date.now()}`

    // Prepare email message
    const msg = {
      to: to,
      from: {
        email: process.env.FROM_EMAIL || 'noreply@example.com',
        name: process.env.FROM_NAME || 'Demand Letter System'
      },
      subject: subject,
      html: html,
      // Custom args for tracking correlation
      customArgs: {
        letter_id: letterId,
        tracking_id: trackingId
      },
      // Enable tracking
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
        subscriptionTracking: { enable: false },
        ganalytics: { enable: false }
      },
      // Categories for analytics
      categories: ['demand_letter', 'workflow_automation']
    }

    // Send email
    const [response] = await sgMail.send(msg)
    
    console.log('[SendGrid API] Email sent successfully:', {
      letterId,
      to,
      messageId: response.headers['x-message-id']
    })

    return Response.json({
      success: true,
      messageId: response.headers['x-message-id'],
      trackingId
    })

  } catch (error) {
    console.error('[SendGrid API] Error sending email:', error)
    
    // Extract meaningful error message
    let errorMessage = 'Unknown error'
    if (error.response?.body?.errors?.length > 0) {
      errorMessage = error.response.body.errors[0].message
    } else if (error.message) {
      errorMessage = error.message
    }

    return Response.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
} 