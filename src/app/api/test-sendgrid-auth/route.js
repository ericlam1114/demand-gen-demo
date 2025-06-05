import { NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function GET(request) {
  try {
    console.log('Testing SendGrid authentication...')
    
    // Test with environment variable sender
    const testEmails = [
      {
        from: process.env.FROM_EMAIL || 'test@example.com',
        name: 'ENV Sender Test'
      },
      {
        from: 'collections@nexumcollections.com',
        name: 'Collections Test'
      },
      {
        from: 'noreply@nexumcollections.com',
        name: 'No Reply Test'
      }
    ]

    const results = []

    for (const sender of testEmails) {
      try {
        const msg = {
          to: 'test@example.com', // SendGrid validates but doesn't send to this
          from: {
            email: sender.from,
            name: sender.name
          },
          subject: 'Test',
          text: 'Test',
          mailSettings: {
            sandboxMode: {
              enable: true // This prevents actual sending but validates the request
            }
          }
        }

        await sgMail.send(msg)
        results.push({
          sender: sender.from,
          status: 'success',
          message: 'Sender is verified'
        })
      } catch (error) {
        results.push({
          sender: sender.from,
          status: 'failed',
          error: error.message,
          code: error.code,
          details: error.response?.body?.errors?.[0]?.message
        })
      }
    }

    return NextResponse.json({
      apiKeyPresent: !!process.env.SENDGRID_API_KEY,
      envFromEmail: process.env.FROM_EMAIL,
      results,
      recommendation: results.some(r => r.status === 'success') 
        ? 'Use the verified sender email' 
        : 'You need to verify a sender in SendGrid'
    })

  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 