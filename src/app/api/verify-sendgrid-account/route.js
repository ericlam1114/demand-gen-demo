import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const apiKey = process.env.SENDGRID_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 500 })
    }
    
    // Make a request to SendGrid API to get account info
    const response = await fetch('https://api.sendgrid.com/v3/user/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({
        error: 'Failed to get account info',
        details: error
      }, { status: response.status })
    }
    
    const accountData = await response.json()
    
    // Get verified senders
    const sendersResponse = await fetch('https://api.sendgrid.com/v3/verified_senders', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    const senders = sendersResponse.ok ? await sendersResponse.json() : null
    
    return NextResponse.json({
      account: {
        type: accountData.type,
        reputation: accountData.reputation
      },
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
      verifiedSenders: senders?.results?.map(s => ({
        email: s.from_email,
        name: s.from_name,
        verified: s.verified
      })) || [],
      recommendation: `
        Make sure you're logged into the SendGrid account that owns this API key.
        The account should have these verified senders: ${senders?.results?.map(s => s.from_email).join(', ') || 'none found'}
      `.trim()
    })
    
  } catch (error) {
    console.error('Verify account error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
} 