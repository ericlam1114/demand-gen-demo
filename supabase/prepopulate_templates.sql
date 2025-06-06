-- Prepopulate templates for different communication channels
-- This script creates example templates for email, SMS, and physical mail

-- Insert sample email templates (SendGrid compatible)
INSERT INTO templates (
  name,
  channel,
  email_subject,
  html_content,
  is_default,
  agency_id,
  created_by
) VALUES 
(
  'First Notice - Professional',
  'email',
  'Important: Outstanding Balance Requires Immediate Attention',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Notice</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background-color: #1f2937; color: white; padding: 30px 40px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Payment Notice</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Immediate Attention Required</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 40px;">
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; color: #374151;">
                Dear <strong>{{name}}</strong>,
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; color: #374151;">
                We are writing to inform you of an outstanding balance on your account that requires immediate attention.
            </p>
            
            <!-- Amount Due Box -->
            <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #92400e; font-weight: bold;">TOTAL AMOUNT DUE</p>
                <p style="margin: 0; font-size: 32px; color: #92400e; font-weight: bold;">${{balance}}</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; color: #374151;">
                To resolve this matter and avoid further collection action, please contact us immediately at the number below or make your payment online.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; color: #374151;">
                <strong>Payment Options:</strong><br>
                • Call us at: <strong>(555) 123-4567</strong><br>
                • Email: <strong>payments@company.com</strong><br>
                • Online: <strong>www.company.com/pay</strong>
            </p>
            
            <!-- Call to Action Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{payment_link}}" style="background-color: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Pay Now Online
                </a>
            </div>
            
            <p style="font-size: 14px; line-height: 1.5; margin: 30px 0 0 0; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <strong>Important:</strong> If you have already made payment or believe this notice is in error, please contact us immediately. This communication is from a debt collector and is an attempt to collect a debt.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px 40px; text-align: center; font-size: 12px; color: #6b7280;">
            <p style="margin: 0;">{{company_name}} | {{company_address}} | {{company_phone}}</p>
        </div>
    </div>
</body>
</html>',
  false,
  (SELECT id FROM agencies LIMIT 1),
  NULL
),
(
  'Second Notice - Urgent',
  'email',
  'URGENT: Final Notice Before Legal Action - Account {{account_number}}',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Final Notice</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background-color: #dc2626; color: white; padding: 30px 40px; text-align: center;">
            <h1 style="margin: 0; font-size: 26px; font-weight: bold;">⚠️ FINAL NOTICE</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Legal Action May Be Initiated</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 40px;">
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; color: #374151;">
                Dear <strong>{{name}}</strong>,
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; color: #374151;">
                This is your <strong>FINAL NOTICE</strong> regarding the outstanding balance on your account. Despite our previous attempts to contact you, this debt remains unpaid.
            </p>
            
            <!-- Amount Due Box -->
            <div style="background-color: #fee2e2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #991b1b; font-weight: bold;">FINAL AMOUNT DUE</p>
                <p style="margin: 0; font-size: 36px; color: #991b1b; font-weight: bold;">${{balance}}</p>
            </div>
            
            <!-- Urgency Box -->
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0;">
                <p style="margin: 0 0 10px 0; font-size: 16px; color: #92400e; font-weight: bold;">IMMEDIATE ACTION REQUIRED</p>
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                    You have <strong>7 days</strong> from the date of this notice to resolve this matter before we proceed with legal action, which may include wage garnishment, bank levies, or liens against your property.
                </p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; color: #374151;">
                <strong>Contact us immediately to:</strong><br>
                • Arrange payment in full<br>
                • Discuss payment plan options<br>
                • Resolve any disputes regarding this debt
            </p>
            
            <!-- Call to Action Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="tel:{{company_phone}}" style="background-color: #dc2626; color: white; padding: 18px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px; display: inline-block; margin-right: 10px;">
                    Call Now: {{company_phone}}
                </a>
                <a href="{{payment_link}}" style="background-color: #3b82f6; color: white; padding: 18px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px; display: inline-block;">
                    Pay Online
                </a>
            </div>
            
            <p style="font-size: 12px; line-height: 1.5; margin: 30px 0 0 0; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                <strong>LEGAL NOTICE:</strong> This is an attempt to collect a debt by a debt collector. Any information obtained will be used for that purpose. Unless you dispute the validity of this debt within 30 days, we will assume it is valid.
            </p>
        </div>
    </div>
</body>
</html>',
  false,
  (SELECT id FROM agencies LIMIT 1),
  NULL
);

-- Insert sample SMS templates (Twilio compatible)
INSERT INTO templates (
  name,
  channel,
  sms_content,
  is_default,
  agency_id,
  created_by
) VALUES 
(
  'Payment Reminder - Friendly',
  'sms',
  'Hi {{name}}, this is a friendly reminder that you have an outstanding balance of ${{balance}}. Please call us at {{company_phone}} to discuss payment options. Reply STOP to opt out.',
  false,
  (SELECT id FROM agencies LIMIT 1),
  NULL
),
(
  'Urgent Payment Notice',
  'sms',
  'URGENT: {{name}}, your account balance of ${{balance}} is now past due. Contact us immediately at {{company_phone}} to avoid further action. This is from a debt collector. Reply STOP to opt out.',
  false,
  (SELECT id FROM agencies LIMIT 1),
  NULL
),
(
  'Final Notice SMS',
  'sms',
  'FINAL NOTICE: {{name}}, legal action may be taken for unpaid balance of ${{balance}}. Call {{company_phone}} within 5 days to resolve. This is a debt collection attempt. Reply STOP to opt out.',
  false,
  (SELECT id FROM agencies LIMIT 1),
  NULL
);

-- Insert sample physical mail templates (Lob compatible)
INSERT INTO templates (
  name,
  channel,
  html_content,
  is_default,
  agency_id,
  created_by
) VALUES 
(
  'Formal Demand Letter',
  'physical',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page {
            size: 8.5in 11in;
            margin: 0.75in;
        }
        body {
            font-family: "Times New Roman", serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000;
            margin: 0;
            padding: 0;
        }
        .letterhead {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-name {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .company-info {
            font-size: 10pt;
            line-height: 1.3;
        }
        .date {
            text-align: right;
            margin-bottom: 30px;
            font-size: 11pt;
        }
        .recipient {
            margin-bottom: 30px;
            font-size: 11pt;
        }
        .subject {
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 20px;
            text-align: center;
            font-size: 13pt;
        }
        .amount-box {
            border: 2px solid #000;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
            background-color: #f0f0f0;
        }
        .amount-label {
            font-size: 11pt;
            font-weight: bold;
        }
        .amount {
            font-size: 16pt;
            font-weight: bold;
            margin-top: 5px;
        }
        .signature-block {
            margin-top: 40px;
        }
        .footer {
            position: fixed;
            bottom: 0;
            width: 100%;
            font-size: 8pt;
            text-align: center;
            border-top: 1px solid #000;
            padding-top: 10px;
        }
        p {
            margin-bottom: 15px;
            text-align: justify;
        }
        .warning-box {
            border: 1px solid #000;
            padding: 10px;
            margin: 20px 0;
            font-size: 10pt;
            text-align: center;
        }
    </style>
</head>
<body>
    <!-- Letterhead -->
    <div class="letterhead">
        <div class="company-name">{{company_name}}</div>
        <div class="company-info">
            {{company_address}}<br>
            Phone: {{company_phone}} | Email: {{company_email}}<br>
            License #: {{license_number}}
        </div>
    </div>

    <!-- Date -->
    <div class="date">
        {{current_date}}
    </div>

    <!-- Recipient -->
    <div class="recipient">
        {{name}}<br>
        {{address}}<br>
        {{city}}, {{state}} {{zip}}
    </div>

    <!-- Subject -->
    <div class="subject">
        DEMAND FOR PAYMENT
    </div>

    <!-- Body -->
    <p>Dear {{name}}:</p>

    <p>
        This letter serves as formal notice that you have an outstanding debt in the amount shown below. 
        This debt is now significantly past due, and despite our previous attempts to contact you, 
        it remains unpaid.
    </p>

    <!-- Amount Due Box -->
    <div class="amount-box">
        <div class="amount-label">TOTAL AMOUNT DUE</div>
        <div class="amount">${{balance}}</div>
        <div style="font-size: 10pt; margin-top: 5px;">
            Original Creditor: {{original_creditor}}<br>
            Account Number: {{account_number}}
        </div>
    </div>

    <p>
        <strong>DEMAND FOR PAYMENT:</strong> You are hereby demanded to pay the above amount within 
        <strong>thirty (30) days</strong> from the date of this letter. Failure to pay this amount 
        or contact our office to make satisfactory payment arrangements may result in legal action 
        being taken against you.
    </p>

    <p>
        Legal action may include, but is not limited to, filing a lawsuit to obtain a judgment 
        against you, wage garnishment, bank account levies, or liens against your real or 
        personal property.
    </p>

    <div class="warning-box">
        <strong>IMPORTANT LEGAL NOTICE</strong><br>
        This is an attempt to collect a debt. Any information obtained will be used for that purpose. 
        Unless you notify this office within 30 days after receiving this notice that you dispute 
        the validity of this debt, this office will assume this debt is valid.
    </div>

    <p>
        If you believe this debt is not yours or you dispute the amount, you must notify us in 
        writing within thirty (30) days of receiving this letter. If you do not dispute this 
        debt within that time period, we will assume the debt is valid.
    </p>

    <p>
        To resolve this matter immediately, please contact our office at {{company_phone}} or 
        send payment to the address listed above. We accept payment by certified check, money 
        order, or cashier''s check.
    </p>

    <p>
        We encourage you to contact us to discuss payment arrangements if you cannot pay the 
        full amount immediately. However, time is of the essence, and we must hear from you 
        within thirty (30) days.
    </p>

    <!-- Signature Block -->
    <div class="signature-block">
        <p>Sincerely,</p>
        <br><br>
        <p>
            _________________________<br>
            {{collector_name}}<br>
            {{collector_title}}<br>
            {{company_name}}
        </p>
    </div>

    <!-- Footer -->
    <div class="footer">
        This communication is from a debt collector. This is an attempt to collect a debt and any 
        information obtained will be used for that purpose.
    </div>
</body>
</html>',
  false,
  (SELECT id FROM agencies LIMIT 1),
  NULL
),
(
  'Attorney Letter - Legal Letterhead',
  'physical',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page {
            size: 8.5in 11in;
            margin: 1in;
        }
        body {
            font-family: "Times New Roman", serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
            margin: 0;
            padding: 0;
        }
        .letterhead {
            text-align: center;
            border-bottom: 3px double #000;
            padding-bottom: 15px;
            margin-bottom: 25px;
        }
        .firm-name {
            font-size: 20pt;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }
        .attorney-info {
            font-size: 9pt;
            line-height: 1.2;
            font-style: italic;
        }
        .date-ref {
            display: flex;
            justify-content: space-between;
            margin-bottom: 25px;
            font-size: 10pt;
        }
        .recipient {
            margin-bottom: 25px;
            font-size: 11pt;
        }
        .re-line {
            font-weight: bold;
            margin-bottom: 20px;
            text-decoration: underline;
        }
        .amount-demand {
            border: 3px solid #000;
            padding: 20px;
            text-align: center;
            margin: 25px 0;
            background-color: #f8f8f8;
        }
        .amount-header {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .amount-figure {
            font-size: 24pt;
            font-weight: bold;
            margin: 10px 0;
        }
        .legal-warning {
            border: 2px solid #000;
            padding: 15px;
            margin: 25px 0;
            font-size: 10pt;
            text-align: center;
            font-weight: bold;
        }
        .signature-block {
            margin-top: 35px;
        }
        .footer {
            position: fixed;
            bottom: 0.5in;
            width: 100%;
            font-size: 8pt;
            text-align: center;
            border-top: 1px solid #000;
            padding-top: 8px;
        }
        p {
            margin-bottom: 12px;
            text-align: justify;
        }
        .indent {
            text-indent: 2em;
        }
    </style>
</head>
<body>
    <!-- Law Firm Letterhead -->
    <div class="letterhead">
        <div class="firm-name">{{law_firm_name}}</div>
        <div class="attorney-info">
            Attorneys and Counselors at Law<br>
            {{firm_address}}<br>
            Telephone: {{firm_phone}} | Facsimile: {{firm_fax}}<br>
            {{attorney_email}} | Bar #: {{bar_number}}
        </div>
    </div>

    <!-- Date and Reference -->
    <div class="date-ref">
        <div>{{current_date}}</div>
        <div>Our File: {{file_number}}</div>
    </div>

    <!-- Recipient -->
    <div class="recipient">
        {{name}}<br>
        {{address}}<br>
        {{city}}, {{state}} {{zip}}
    </div>

    <!-- Re Line -->
    <div class="re-line">
        RE: Demand for Payment - Account #{{account_number}}<br>
        Original Creditor: {{original_creditor}}
    </div>

    <!-- Salutation -->
    <p>Dear {{name}}:</p>

    <!-- Opening Paragraph -->
    <p class="indent">
        Our law firm has been retained by {{client_name}} to collect the debt referenced above. 
        Our records indicate that you owe the amount set forth below, which represents the 
        outstanding balance on your account with the original creditor.
    </p>

    <!-- Amount Due -->
    <div class="amount-demand">
        <div class="amount-header">AMOUNT CURRENTLY DUE AND OWING</div>
        <div class="amount-figure">${{balance}}</div>
        <div style="font-size: 10pt; margin-top: 10px;">
            Plus interest, costs, and attorney''s fees as permitted by law
        </div>
    </div>

    <!-- Demand Paragraph -->
    <p class="indent">
        <strong>TAKE NOTICE</strong> that unless you pay the above amount within <strong>TEN (10) DAYS</strong> 
        from the date of this letter, or contact this office to make arrangements satisfactory to our 
        client for the payment of this debt, we will have no alternative but to recommend to our client 
        that a lawsuit be filed against you to recover the amount due.
    </p>

    <!-- Legal Consequences -->
    <p class="indent">
        Should a lawsuit be filed and a judgment obtained against you, our client may be entitled to 
        recover additional costs and reasonable attorney''s fees. Furthermore, the judgment may be 
        enforced by wage garnishment, bank account levy, or other collection methods permitted by law.
    </p>

    <!-- Legal Warning Box -->
    <div class="legal-warning">
        IMPORTANT: THIS IS AN ATTEMPT TO COLLECT A DEBT<br>
        AND ANY INFORMATION OBTAINED WILL BE USED FOR THAT PURPOSE
    </div>

    <!-- Dispute Rights -->
    <p class="indent">
        Unless you notify this office within thirty (30) days after receiving this notice that you 
        dispute the validity of this debt, or any portion thereof, this office will assume this debt 
        is valid. If you notify this office in writing within thirty (30) days that you dispute this 
        debt, this office will obtain verification of the debt and mail you a copy of such verification.
    </p>

    <!-- Contact Information -->
    <p class="indent">
        If you have any questions concerning this matter, or if you wish to discuss settlement, 
        please contact the undersigned immediately at {{firm_phone}}. We are available Monday 
        through Friday from 9:00 AM to 5:00 PM.
    </p>

    <!-- Closing -->
    <p class="indent">
        We trust you will give this matter your immediate attention and look forward to your prompt response.
    </p>

    <!-- Signature Block -->
    <div class="signature-block">
        <p>Very truly yours,</p>
        <br><br>
        <p>
            _________________________<br>
            {{attorney_name}}, Esq.<br>
            Attorney for {{client_name}}<br>
            State Bar #: {{bar_number}}
        </p>
    </div>

    <!-- Footer -->
    <div class="footer">
        This law firm is a debt collector attempting to collect a debt. Any information obtained will be used for that purpose.
    </div>
</body>
</html>',
  false,
  (SELECT id FROM agencies LIMIT 1),
  NULL
);

-- Note: These templates use placeholder variables that should be replaced when sending
-- Available variables include:
-- {{name}} - Debtor name
-- {{balance}} - Amount owed
-- {{company_name}} - Collection agency name
-- {{company_phone}} - Phone number
-- {{company_email}} - Email address
-- {{company_address}} - Mailing address
-- {{account_number}} - Account reference
-- {{original_creditor}} - Original creditor name
-- {{current_date}} - Current date
-- {{payment_link}} - Online payment URL
-- And many more based on your data structure