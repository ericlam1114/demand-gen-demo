import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    // First check if agencies already exist
    const { data: existingAgencies } = await supabase
      .from('agencies')
      .select('id')
      .limit(1)

    if (existingAgencies && existingAgencies.length > 0) {
      // Agency exists, now check templates
      return await populateTemplates(existingAgencies[0].id)
    }

    // Create a demo agency first
    const { data: agencyData, error: agencyError } = await supabase
      .from('agencies')
      .insert({
        name: 'Demo Collections Agency',
        slug: 'demo-collections',
        plan: 'professional',
        max_users: 5,
        max_letters_per_month: 2500,
        is_active: true
      })
      .select()
      .single()

    if (agencyError) {
      console.error('Error creating agency:', agencyError)
      return Response.json({ error: agencyError.message }, { status: 500 })
    }

    // Now populate templates
    return await populateTemplates(agencyData.id)

  } catch (error) {
    console.error('Error setting up demo:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

async function populateTemplates(agencyId) {
  try {
    // Check if templates already exist for this agency
    const { data: existingTemplates } = await supabase
      .from('templates')
      .select('id')
      .eq('agency_id', agencyId)
      .limit(1)

    if (existingTemplates && existingTemplates.length > 0) {
      return Response.json({ message: 'Templates already exist', agencyId })
    }

    // Create sample templates
    const templates = [
      // Email Templates
      {
        name: 'First Notice - Professional',
        channel: 'email',
        email_subject: 'Important: Outstanding Balance Requires Immediate Attention',
        html_content: `Dear {{name}},

We are writing to inform you of an outstanding balance on your account that requires immediate attention.

TOTAL AMOUNT DUE: ${{balance}}

To resolve this matter and avoid further collection action, please contact us immediately at {{company_phone}} or make your payment online.

Payment Options:
• Call us at: {{company_phone}}
• Email: payments@company.com
• Online Payment Portal: Available 24/7

If you have already made payment or believe this notice is in error, please contact us immediately. This communication is from a debt collector and is an attempt to collect a debt.

Sincerely,
{{company_name}} Collections Department`,
        agency_id: agencyId,
        is_default: false
      },
      {
        name: 'Second Notice - Urgent',
        channel: 'email',
        email_subject: 'URGENT: Final Notice Before Legal Action',
        html_content: `Dear {{name}},

This is your FINAL NOTICE regarding the outstanding balance on your account. Despite our previous attempts to contact you, this debt remains unpaid.

FINAL AMOUNT DUE: ${{balance}}

IMMEDIATE ACTION REQUIRED
You have 7 days from the date of this notice to resolve this matter before we proceed with legal action.

Contact us immediately to:
• Arrange payment in full
• Discuss payment plan options  
• Resolve any disputes regarding this debt

Call Now: {{company_phone}}

LEGAL NOTICE: This is an attempt to collect a debt by a debt collector. Any information obtained will be used for that purpose.`,
        agency_id: agencyId,
        is_default: false
      },

      // SMS Templates  
      {
        name: 'Payment Reminder - Friendly',
        channel: 'sms',
        sms_content: 'Hi {{name}}, friendly reminder of ${{balance}} balance. Call {{company_phone}} for payment options. Reply STOP to opt out.',
        agency_id: agencyId,
        is_default: false
      },
      {
        name: 'Urgent Payment Notice',
        channel: 'sms', 
        sms_content: 'URGENT: {{name}}, ${{balance}} past due. Call {{company_phone}} immediately. This is from a debt collector. Reply STOP to opt out.',
        agency_id: agencyId,
        is_default: false
      },

      // Physical Mail Templates
      {
        name: 'Formal Demand Letter',
        channel: 'physical',
        html_content: `{{current_date}}

{{name}}
{{address}}
{{city}}, {{state}} {{zip}}

DEMAND FOR PAYMENT

Dear {{name}}:

This letter serves as formal notice that you have an outstanding debt in the amount of ${{balance}}.

This debt is now significantly past due, and despite our previous attempts to contact you, it remains unpaid.

DEMAND FOR PAYMENT: You are hereby demanded to pay the above amount within thirty (30) days from the date of this letter.

Failure to pay this amount or contact our office may result in legal action being taken against you.

IMPORTANT LEGAL NOTICE
This is an attempt to collect a debt. Any information obtained will be used for that purpose. Unless you notify this office within 30 days that you dispute the validity of this debt, this office will assume this debt is valid.

To resolve this matter immediately, please contact our office at {{company_phone}}.

Sincerely,

{{collector_name}}
{{company_name}}

This communication is from a debt collector.`,
        agency_id: agencyId,
        is_default: false
      }
    ]

    // Insert all templates
    const { data, error } = await supabase
      .from('templates')
      .insert(templates)
      .select()

    if (error) {
      console.error('Error inserting templates:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ 
      message: 'Demo setup completed successfully', 
      agencyId,
      templatesCount: data.length,
      templates: data.map(t => ({ id: t.id, name: t.name, channel: t.channel }))
    })

  } catch (error) {
    console.error('Error populating templates:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}