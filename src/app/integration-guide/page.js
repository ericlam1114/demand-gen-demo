'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink, Book, Zap, BarChart3, Webhook, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'

export default function IntegrationGuide() {
  const [copiedCode, setCopiedCode] = useState('')

  const copyToClipboard = (code, id) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    toast.success('Code copied to clipboard!')
    setTimeout(() => setCopiedCode(''), 2000)
  }

  const codeExamples = {
    authentication: `// Authentication Example
const apiKey = 'your-agency-slug_api_key_12345678'
const agencySlug = 'your-agency-slug'

const headers = {
  'Authorization': \`Bearer \${apiKey}\`,
  'X-Agency-Slug': agencySlug,
  'Content-Type': 'application/json'
}`,

    bulkUpload: `// Bulk Upload Debtors Example
const response = await fetch('/api/integration/debtors/bulk', {
  method: 'POST',
  headers: headers,
  body: JSON.stringify({
    debtors: [
      {
        name: 'John Smith',
        email: 'john@example.com',
        balance: 1500.00,
        external_id: 'CUST001',
        phone: '555-123-4567',
        state: 'CA',
        original_creditor: 'ACME Corp'
      },
      {
        name: 'Jane Doe', 
        email: 'jane@example.com',
        balance: 2500.00,
        external_id: 'CUST002',
        auto_enroll: true
      }
    ],
    auto_enroll: true
  })
})

const result = await response.json()
console.log(\`Created: \${result.results.created.length}\`)
console.log(\`Updated: \${result.results.updated.length}\`)`,

    webhook: `// Webhook Configuration Example
const webhookConfig = await fetch('/api/webhooks', {
  method: 'POST',
  headers: headers,
  body: JSON.stringify({
    url: 'https://your-system.com/webhooks/demand-letters',
    events: [
      'letter.sent',
      'letter.opened', 
      'response.received',
      'campaign.completed'
    ],
    secret: 'your-webhook-secret'
  })
})`,

    analytics: `// Campaign Performance Analytics
const performance = await fetch(\`/api/integration/reports/campaign-performance?\${new URLSearchParams({
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  client_id: 'ACME_CORP',
  group_by: 'month'
})}\`, {
  headers: headers
})

const data = await performance.json()
console.log(\`Collection Rate: \${data.overall_metrics.collection_rate}%\`)
console.log(\`Best Workflow: \${data.complimentary_insights.best_performing_workflow}\`)`,

    export: `// Export Data Example
const exportUrl = \`/api/integration/export?\${new URLSearchParams({
  type: 'debtors',
  format: 'csv',
  status: 'active',
  start_date: '2024-01-01'
})}\`

const exportResponse = await fetch(exportUrl, { headers })
const csvData = await exportResponse.text()

// Or get JSON format
const jsonExport = await fetch('/api/integration/export?type=all&format=json', { headers })
const jsonData = await jsonExport.json()`
  }

  const features = [
    {
      icon: <Upload className="h-6 w-6" />,
      title: "Bulk Data Operations",
      description: "Import/export large datasets seamlessly with your existing system",
      benefits: ["Upload 1000+ debtors at once", "Automatic workflow enrollment", "Duplicate detection", "CSV/JSON formats"]
    },
    {
      icon: <Webhook className="h-6 w-6" />,
      title: "Real-time Webhooks",
      description: "Get instant notifications when letters are sent, opened, or paid",
      benefits: ["Real-time status updates", "HMAC signature verification", "Retry mechanism", "Custom event filtering"]
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Enhanced Analytics",
      description: "Detailed performance metrics to complement your reporting",
      benefits: ["Campaign ROI analysis", "Client-specific metrics", "Time-series data", "Actionable recommendations"]
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "RESTful API",
      description: "Complete programmatic access to all demand letter functionality",
      benefits: ["Full CRUD operations", "Pagination support", "Error handling", "Rate limiting"]
    }
  ]

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="container mx-auto py-8 px-4 max-w-6xl">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Book className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold">Integration Guide</h1>
              <Badge variant="secondary">Complimentary System</Badge>
            </div>
            <p className="text-gray-600 text-lg">
              Enhance your existing debt collection system with automated demand letters, 
              real-time analytics, and seamless data synchronization.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {features.map((feature, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="quickstart" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
              <TabsTrigger value="authentication">Authentication</TabsTrigger>
              <TabsTrigger value="bulk-operations">Bulk Operations</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="quickstart" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Getting Started</CardTitle>
                  <CardDescription>
                    This demand letter system is designed to complement your existing debt collection software.
                    It provides specialized letter campaigns and analytics while syncing with your main system.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">1. API Endpoints</h4>
                      <p className="text-sm text-gray-600 mb-2">All endpoints available at:</p>
                      <code className="text-xs bg-gray-100 p-2 rounded block">
                        GET /api/integration
                      </code>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">2. Your API Key</h4>
                      <p className="text-sm text-gray-600 mb-2">Format:</p>
                      <code className="text-xs bg-gray-100 p-2 rounded block">
                        your-agency-slug_api_key_xxxxxxxx
                      </code>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Use Cases</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Push new debtors from your CRM to start letter campaigns</li>
                      <li>• Receive real-time notifications when letters are opened</li>
                      <li>• Pull campaign performance data for your reporting dashboard</li>
                      <li>• Export letter responses to update your main system</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="authentication" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>API Authentication</CardTitle>
                  <CardDescription>
                    All API requests require authentication using your agency API key and slug.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{codeExamples.authentication}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(codeExamples.authentication, 'auth')}
                      >
                        {copiedCode === 'auth' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-amber-800 mb-2">Security Notes</h4>
                      <ul className="text-sm text-amber-700 space-y-1">
                        <li>• Store API keys securely (environment variables)</li>
                        <li>• Use HTTPS for all requests</li>
                        <li>• Implement proper error handling</li>
                        <li>• Respect rate limits (100 requests/minute)</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bulk-operations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Bulk Data Operations</CardTitle>
                  <CardDescription>
                    Import large datasets and export campaign results efficiently.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3">Bulk Import Debtors</h4>
                      <div className="relative">
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                          <code>{codeExamples.bulkUpload}</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(codeExamples.bulkUpload, 'bulk')}
                        >
                          {copiedCode === 'bulk' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Export Data</h4>
                      <div className="relative">
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                          <code>{codeExamples.export}</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(codeExamples.export, 'export')}
                        >
                          {copiedCode === 'export' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Webhook Configuration</CardTitle>
                  <CardDescription>
                    Receive real-time notifications when events occur in your letter campaigns.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{codeExamples.webhook}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(codeExamples.webhook, 'webhook')}
                      >
                        {copiedCode === 'webhook' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Available Events</h4>
                        <ul className="text-sm space-y-1">
                          <li>• <code>letter.sent</code> - Letter delivered</li>
                          <li>• <code>letter.opened</code> - Tracking pixel loaded</li>
                          <li>• <code>letter.bounced</code> - Email bounced</li>
                          <li>• <code>response.received</code> - Debtor replied</li>
                          <li>• <code>campaign.completed</code> - Workflow finished</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Webhook Security</h4>
                        <ul className="text-sm space-y-1">
                          <li>• HMAC SHA-256 signatures</li>
                          <li>• Automatic retry on failure</li>
                          <li>• 10 second timeout</li>
                          <li>• Custom user agent</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Analytics</CardTitle>
                  <CardDescription>
                    Access detailed performance metrics to enhance your reporting dashboard.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{codeExamples.analytics}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(codeExamples.analytics, 'analytics')}
                      >
                        {copiedCode === 'analytics' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Overall Metrics</h4>
                        <ul className="text-sm space-y-1">
                          <li>• Open rate</li>
                          <li>• Payment rate</li>
                          <li>• Collection rate</li>
                          <li>• Average balance</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Workflow Performance</h4>
                        <ul className="text-sm space-y-1">
                          <li>• Per-workflow metrics</li>
                          <li>• Comparative analysis</li>
                          <li>• Success rates</li>
                          <li>• Best practices</li>
                        </ul>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Client Insights</h4>
                        <ul className="text-sm space-y-1">
                          <li>• Portfolio-specific data</li>
                          <li>• Collection trends</li>
                          <li>• Time-series analysis</li>
                          <li>• Recommendations</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
              <CardDescription>
                Integration support and documentation resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Button variant="outline" className="h-auto p-4 flex-col">
                  <ExternalLink className="h-6 w-6 mb-2" />
                  <span className="font-semibold">API Documentation</span>
                  <span className="text-sm text-gray-600">Complete API reference</span>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex-col">
                  <Book className="h-6 w-6 mb-2" />
                  <span className="font-semibold">Integration Examples</span>
                  <span className="text-sm text-gray-600">Sample code and tutorials</span>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex-col">
                  <Zap className="h-6 w-6 mb-2" />
                  <span className="font-semibold">Technical Support</span>
                  <span className="text-sm text-gray-600">Get help with integration</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  )
} 