import { NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function GET(request) {
  try {
    console.log('Testing SendGrid email...')
    console.log('API Key present:', !!process.env.SENDGRID_API_KEY)
    console.log('From Email:', process.env.FROM_EMAIL)
    
    const msg = {
      to: 'ericlam1114@gmail.com',
      from: {
        email: process.env.FROM_EMAIL || 'noreply@nexumcollections.com',
        name: 'Nexum Collections Test'
      },
      subject: 'Test Email from Demand Gen Demo',
      text: 'This is a test email to verify SendGrid is working.',
      html: '<strong>This is a test email to verify SendGrid is working.</strong>',
    }

    try {
      const result = await sgMail.send(msg)
      console.log('SendGrid response:', result)
      
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        to: msg.to,
        from: msg.from
      })
    } catch (sendError) {
      console.error('SendGrid error:', sendError)
      console.error('Error response:', sendError.response?.body)
      
      return NextResponse.json({
        success: false,
        error: sendError.message,
        code: sendError.code,
        response: sendError.response?.body
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 