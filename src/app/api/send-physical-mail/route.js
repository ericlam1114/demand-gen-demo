import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Mock Lob API integration for now
// In production, install and use the Lob SDK: npm install lob
// import Lob from 'lob'
// const lob = new Lob(process.env.LOB_API_KEY)

export async function POST(request) {
  try {
    const { debtor_id, template_id, company_settings } = await request.json()
    
    if (!debtor_id || !template_id) {
      return NextResponse.json(
        { error: 'Debtor ID and template ID are required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Get debtor information
    const { data: debtor, error: debtorError } = await supabase
      .from('debtors')
      .select('*')
      .eq('id', debtor_id)
      .single()

    if (debtorError || !debtor) {
      return NextResponse.json(
        { error: 'Debtor not found' },
        { status: 404 }
      )
    }

    // Get template information
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', template_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Validate debtor has required address information
    if (!debtor.address || !debtor.city || !debtor.state || !debtor.zip) {
      return NextResponse.json(
        { error: 'Debtor address information is incomplete' },
        { status: 400 }
      )
    }

    try {
      // Mock Lob integration - replace with actual Lob API call in production
      const lobResponse = await mockLobApiCall(debtor, template, company_settings)
      
      // Record the letter in database
      const { data: letter, error: letterError } = await supabase
        .from('letters')
        .insert({
          debtor_id: debtor_id,
          template_id: template_id,
          channel: 'physical',
          status: 'sent',
          sent_at: new Date().toISOString(),
          lob_letter_id: lobResponse.id,
          pdf_url: lobResponse.url,
          tracking_url: lobResponse.tracking_url
        })
        .select()
        .single()

      if (letterError) {
        console.error('Error recording letter:', letterError)
        throw letterError
      }

      return NextResponse.json({
        success: true,
        letter_id: letter.id,
        lob_letter_id: lobResponse.id,
        tracking_url: lobResponse.tracking_url,
        estimated_delivery: lobResponse.expected_delivery_date,
        message: 'Physical letter sent successfully via Lob'
      })

    } catch (lobError) {
      console.error('Lob API error:', lobError)
      return NextResponse.json(
        { error: 'Failed to send physical mail', details: lobError.message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Physical mail API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Mock Lob API call - replace with actual implementation
async function mockLobApiCall(debtor, template, companySettings) {
  // In production, this would be:
  /*
  const letter = await lob.letters.create({
    description: `Demand Letter - ${debtor.name}`,
    to: {
      name: debtor.name,
      address_line1: debtor.address,
      address_city: debtor.city,
      address_state: debtor.state,
      address_zip: debtor.zip,
      address_country: debtor.country || 'US'
    },
    from: {
      name: companySettings?.company_name || 'Collections Agency',
      address_line1: companySettings?.company_address || '123 Business St',
      address_city: companySettings?.company_city || 'Business City',
      address_state: companySettings?.company_state || 'CA',
      address_zip: companySettings?.company_zip || '12345',
      address_country: 'US'
    },
    file: template.physical_body || template.html_content,
    color: false, // Set to true for color printing
    double_sided: false,
    address_placement: 'top_first_page'
  })
  
  return letter
  */

  // Mock response for demo purposes
  await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API delay
  
  return {
    id: `ltr_${Math.random().toString(36).substr(2, 9)}`,
    url: `https://lob.com/letters/ltr_${Math.random().toString(36).substr(2, 9)}.pdf`,
    tracking_url: `https://lob.com/letters/ltr_${Math.random().toString(36).substr(2, 9)}/tracking`,
    expected_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 3 days from now
  }
} 