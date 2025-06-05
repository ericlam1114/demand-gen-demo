# SendGrid Webhook Configuration Guide

To enable email tracking and see events in your SendGrid dashboard, follow these steps:

## 1. Configure Webhook in SendGrid

1. Log into your SendGrid account
2. Navigate to **Settings > Mail Settings > Event Webhooks**
3. Enable **Event Webhook**
4. Set the **HTTP Post URL** to:
   - For local development: Use ngrok to expose your local endpoint
   - For production: `https://your-domain.com/api/sendgrid-webhook`

5. Select the events you want to track:
   - ✅ Processed
   - ✅ Delivered
   - ✅ Opened
   - ✅ Clicked
   - ✅ Bounced
   - ✅ Dropped
   - ✅ Spam Reports
   - ✅ Unsubscribe

6. If using webhook verification, copy the **Verification Key** and add to your `.env.local`:
   ```
   SENDGRID_WEBHOOK_VERIFICATION_KEY=your_verification_key_here
   ```

7. Click **Save**

## 2. Test Webhook Connection

1. In SendGrid, click **Test Your Integration**
2. You should see test events appear in your console logs

## 3. Using Ngrok for Local Development

If testing locally, use ngrok to expose your webhook endpoint:

```bash
# Install ngrok
brew install ngrok

# Expose your local server
ngrok http 3000

# Use the HTTPS URL provided by ngrok in SendGrid
# Example: https://abc123.ngrok.io/api/sendgrid-webhook
```

## 4. Verify Events are Being Tracked

After configuring webhooks, send a test email and check:
1. Your database `email_events` table for new records
2. SendGrid Activity Feed should start showing events
3. Statistics should update within a few minutes

## Troubleshooting

- **No events appearing**: Check your webhook URL is accessible
- **401 Unauthorized**: Verify your webhook verification key
- **Events not in database**: Check RLS policies on `email_events` table
- **Still no statistics**: Confirm you're viewing the correct SendGrid account 