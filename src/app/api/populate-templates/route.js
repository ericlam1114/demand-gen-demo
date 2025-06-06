import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    // First check if templates already exist
    const { data: existingTemplates } = await supabase
      .from('templates')
      .select('id')
      .limit(1)

    if (existingTemplates && existingTemplates.length > 0) {
      return Response.json({ message: 'Templates already exist', count: existingTemplates.length })
    }

    // Get the first agency for demo purposes
    const { data: agencies } = await supabase
      .from('agencies')
      .select('id')
      .limit(1)

    const agencyId = agencies?.[0]?.id

    if (!agencyId) {
      return Response.json({ error: 'No agency found' }, { status: 400 })
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

To resolve this matter and avoid further collection action, please contact us immediately at {{company_phone}} or make your payment online at {{payment_link}}.

Payment Options:
• Call us at: {{company_phone}}
• Email: {{company_email}}
• Online: {{payment_link}}

If you have already made payment or believe this notice is in error, please contact us immediately. This communication is from a debt collector and is an attempt to collect a debt.

Sincerely,
{{company_name}} Collections Department`,
        agency_id: agencyId,
        is_default: false
      },
      {
        name: 'Second Notice - Urgent',
        channel: 'email',
        email_subject: 'URGENT: Final Notice Before Legal Action - Account {{account_number}}',
        html_content: `Dear {{name}},

This is your FINAL NOTICE regarding the outstanding balance on your account. Despite our previous attempts to contact you, this debt remains unpaid.

FINAL AMOUNT DUE: ${{balance}}

IMMEDIATE ACTION REQUIRED
You have 7 days from the date of this notice to resolve this matter before we proceed with legal action, which may include wage garnishment, bank levies, or liens against your property.

Contact us immediately to:
• Arrange payment in full
• Discuss payment plan options
• Resolve any disputes regarding this debt

Call Now: {{company_phone}}
Pay Online: {{payment_link}}

LEGAL NOTICE: This is an attempt to collect a debt by a debt collector. Any information obtained will be used for that purpose. Unless you dispute the validity of this debt within 30 days, we will assume it is valid.

{{company_name}}
{{company_address}}
{{company_phone}}`,
        agency_id: agencyId,
        is_default: false
      },

      // SMS Templates
      {
        name: 'Payment Reminder - Friendly',
        channel: 'sms',
        sms_content: 'Hi {{name}}, this is a friendly reminder that you have an outstanding balance of ${{balance}}. Please call us at {{company_phone}} to discuss payment options. Reply STOP to opt out.',
        agency_id: agencyId,
        is_default: false
      },
      {
        name: 'Urgent Payment Notice',
        channel: 'sms',
        sms_content: 'URGENT: {{name}}, your account balance of ${{balance}} is now past due. Contact us immediately at {{company_phone}} to avoid further action. This is from a debt collector. Reply STOP to opt out.',
        agency_id: agencyId,
        is_default: false
      },
      {
        name: 'Final Notice SMS',
        channel: 'sms',
        sms_content: 'FINAL NOTICE: {{name}}, legal action may be taken for unpaid balance of ${{balance}}. Call {{company_phone}} within 5 days to resolve. This is a debt collection attempt. Reply STOP to opt out.',
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

This letter serves as formal notice that you have an outstanding debt in the amount shown below. This debt is now significantly past due, and despite our previous attempts to contact you, it remains unpaid.

TOTAL AMOUNT DUE: ${{balance}}
Original Creditor: {{original_creditor}}
Account Number: {{account_number}}

DEMAND FOR PAYMENT: You are hereby demanded to pay the above amount within thirty (30) days from the date of this letter. Failure to pay this amount or contact our office to make satisfactory payment arrangements may result in legal action being taken against you.

Legal action may include, but is not limited to, filing a lawsuit to obtain a judgment against you, wage garnishment, bank account levies, or liens against your real or personal property.

IMPORTANT LEGAL NOTICE
This is an attempt to collect a debt. Any information obtained will be used for that purpose. Unless you notify this office within 30 days after receiving this notice that you dispute the validity of this debt, this office will assume this debt is valid.

If you believe this debt is not yours or you dispute the amount, you must notify us in writing within thirty (30) days of receiving this letter. If you do not dispute this debt within that time period, we will assume the debt is valid.

To resolve this matter immediately, please contact our office at {{company_phone}} or send payment to the address listed above. We accept payment by certified check, money order, or cashier's check.

We encourage you to contact us to discuss payment arrangements if you cannot pay the full amount immediately. However, time is of the essence, and we must hear from you within thirty (30) days.

Sincerely,

{{collector_name}}
{{collector_title}}
{{company_name}}

This communication is from a debt collector. This is an attempt to collect a debt and any information obtained will be used for that purpose.`,
        agency_id: agencyId,
        is_default: false
      },
      {
        name: 'Attorney Letter - Legal',
        channel: 'physical',
        html_content: `{{law_firm_name}}
Attorneys and Counselors at Law
{{firm_address}}
Telephone: {{firm_phone}} | Email: {{attorney_email}}
Bar #: {{bar_number}}

{{current_date}}                                                File: {{file_number}}

{{name}}
{{address}}
{{city}}, {{state}} {{zip}}

RE: Demand for Payment - Account #{{account_number}}
Original Creditor: {{original_creditor}}

Dear {{name}}:

Our law firm has been retained by {{client_name}} to collect the debt referenced above. Our records indicate that you owe the amount set forth below, which represents the outstanding balance on your account with the original creditor.

AMOUNT CURRENTLY DUE AND OWING: ${{balance}}
Plus interest, costs, and attorney's fees as permitted by law

TAKE NOTICE that unless you pay the above amount within TEN (10) DAYS from the date of this letter, or contact this office to make arrangements satisfactory to our client for the payment of this debt, we will have no alternative but to recommend to our client that a lawsuit be filed against you to recover the amount due.

Should a lawsuit be filed and a judgment obtained against you, our client may be entitled to recover additional costs and reasonable attorney's fees. Furthermore, the judgment may be enforced by wage garnishment, bank account levy, or other collection methods permitted by law.

IMPORTANT: THIS IS AN ATTEMPT TO COLLECT A DEBT
AND ANY INFORMATION OBTAINED WILL BE USED FOR THAT PURPOSE

Unless you notify this office within thirty (30) days after receiving this notice that you dispute the validity of this debt, or any portion thereof, this office will assume this debt is valid. If you notify this office in writing within thirty (30) days that you dispute this debt, this office will obtain verification of the debt and mail you a copy of such verification.

If you have any questions concerning this matter, or if you wish to discuss settlement, please contact the undersigned immediately at {{firm_phone}}. We are available Monday through Friday from 9:00 AM to 5:00 PM.

We trust you will give this matter your immediate attention and look forward to your prompt response.

Very truly yours,

{{attorney_name}}, Esq.
Attorney for {{client_name}}
State Bar #: {{bar_number}}

This law firm is a debt collector attempting to collect a debt. Any information obtained will be used for that purpose.`,
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
      message: 'Templates created successfully', 
      count: data.length,
      templates: data.map(t => ({ id: t.id, name: t.name, channel: t.channel }))
    })

  } catch (error) {
    console.error('Error populating templates:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}