'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/AuthProvider'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { PlanRestrictionBanner } from '@/components/ui/plan-restriction-banner'
import { hasFeature, getUpgradeMessage } from '@/lib/plan-restrictions'
import { 
  Plus, 
  Edit3, 
  Eye, 
  Mail, 
  MessageSquare, 
  FileText, 
  Save,
  Trash2,
  AlertTriangle,
  Smartphone,
  Mailbox,
  Crown,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

function TemplatesContent() {
  const { canDeleteContent, profile, agency, loading: authLoading } = useAuth()
  const currentPlan = agency?.plan || 'free'
  
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false) // Start with false to avoid loading on navigation
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [filterChannel, setFilterChannel] = useState('all')

  const [editorData, setEditorData] = useState({
    name: '',
    email_subject: '',
    sms_content: '',
    html_content: '',
    channel: 'email',
    is_default: false
  })

  // Check feature access
  const smsEnabled = hasFeature(currentPlan, 'sms')

  const channelOptions = [
    { value: 'email', label: 'Email', icon: Mail, color: 'blue', enabled: true },
    { value: 'sms', label: 'SMS', icon: Smartphone, color: 'green', enabled: smsEnabled },
    { value: 'physical', label: 'Physical Mail', icon: Mailbox, color: 'purple', enabled: true }
  ]

  const getChannelInfo = (channel) => {
    return channelOptions.find(opt => opt.value === channel) || channelOptions[0]
  }

  useEffect(() => {
    if (agency?.id) {
    fetchTemplates()
    } else if (!authLoading) {
      // Auth is done loading but no agency
      setLoading(false)
    }
  }, [agency?.id, authLoading])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      console.log('[Templates] Fetching templates for agency:', agency?.id)
      
      if (!agency?.id) {
        console.log('[Templates] No agency_id found, skipping fetch')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('agency_id', agency.id)
        .order('created_at', { ascending: false })

      console.log('[Templates] Query result:', { data: data?.length || 0, error })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('[Templates] Error fetching templates:', error)
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (templateId) => {
    try {
      // Check if template is being used in any workflows
      const { data: workflowSteps, error: checkError } = await supabase
        .from('workflow_steps')
        .select('id')
        .eq('template_id', templateId)
        .limit(1)

      if (checkError) throw checkError

      if (workflowSteps && workflowSteps.length > 0) {
        toast.error('Cannot delete template - it is being used in active workflows')
        return
      }

      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      toast.success('Template deleted successfully')
      fetchTemplates()
      setShowDeleteModal(false)
      setTemplateToDelete(null)
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Failed to delete template')
    }
  }

  const openDeleteModal = (template) => {
    setTemplateToDelete(template)
    setShowDeleteModal(true)
  }

  const loadSampleTemplates = async () => {
    try {
      setLoading(true)
      
      const sampleTemplates = [
        // Email Templates
        {
          name: 'First Notice - Professional',
          channel: 'email',
          email_subject: 'Past Due Balance - ${{balance}}',
          html_content: `Dear {{debtor_name}},

We would like to bring to your attention that we have not yet received payment for the outstanding amount of ${{balance}} relating to your account. The payment was originally due on {{due_date}} and is now considered past due.

To settle your overdue balance conveniently and securely, we encourage you to make your payment online by clicking here: {{payment_link}}

Alternatively, you may mail your payment to the following address:

{{company_name}}
{{company_address}}
{{company_city}}, {{company_state}}, {{company_zip}}

If you have any inquiries regarding this balance or require assistance from a credit representative, please do not hesitate to reach out to {{contact_name}} at {{contact_email}} or {{contact_phone}}.

We appreciate your prompt attention to this matter.

Best regards,

{{contact_name}}
{{company_name}}`,
          agency_id: agency?.id,
          created_by: profile?.id,
          is_default: false
        },
        {
          name: 'Second Notice - Final Warning',
          channel: 'email',
          email_subject: 'FINAL NOTICE - Past Due Balance - ${{balance}}',
          html_content: `Dear {{debtor_name}},

This serves as our FINAL NOTICE regarding your past due balance of ${{balance}}. Despite our previous correspondence, this amount remains unpaid and is now significantly overdue.

URGENT ACTION REQUIRED

Your account is now {{days_past_due}} days past due. To avoid further collection action, including potential legal proceedings, you must contact us immediately to resolve this matter.

Payment Options:
• Online: {{payment_link}}
• Mail payment to:
  {{company_name}}
  {{company_address}}
  {{company_city}}, {{company_state}}, {{company_zip}}

If you believe this notice is in error or wish to discuss payment arrangements, please contact {{contact_name}} immediately at {{contact_email}} or {{contact_phone}}.

Time is of the essence. We must hear from you within 10 days of this notice to avoid escalation of this matter.

Sincerely,

{{contact_name}}
{{contact_title}}
{{company_name}}

IMPORTANT NOTICE: This communication is from a debt collector and is an attempt to collect a debt. Any information obtained will be used for that purpose.`,
          agency_id: agency?.id,
          created_by: profile?.id,
          is_default: false
        },

        // SMS Templates  
        {
          name: 'Payment Reminder - Friendly',
          channel: 'sms',
          sms_content: 'Hi {{name}}, friendly reminder of ${{balance}} balance. Call {{company_phone}} for payment options. Reply STOP to opt out.',
          agency_id: agency?.id,
          created_by: profile?.id,
          is_default: false
        },
        {
          name: 'Urgent Payment Notice',
          channel: 'sms',
          sms_content: 'URGENT: {{name}}, ${{balance}} past due. Call {{company_phone}} immediately. This is from a debt collector. Reply STOP to opt out.',
          agency_id: agency?.id,
          created_by: profile?.id,
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
          agency_id: agency?.id,
          created_by: profile?.id,
          is_default: false
        }
      ]

      // Insert all sample templates
      const { data, error } = await supabase
        .from('templates')
        .insert(sampleTemplates)
        .select()

      if (error) throw error

      toast.success(`${data.length} sample templates created successfully!`)
      fetchTemplates() // Refresh the templates list
      
    } catch (error) {
      console.error('Error loading sample templates:', error)
      toast.error('Failed to load sample templates')
    } finally {
      setLoading(false)
    }
  }

  const saveTemplate = async () => {
    try {
      console.log('[Template Update] Save template called:', { 
        isEditing, 
        selectedTemplateId: selectedTemplate?.id, 
        selectedTemplateType: typeof selectedTemplate,
        editorData,
        profileId: profile?.id,
        agencyId: agency?.id 
      })
      
      // Basic validation
      if (!editorData.name?.trim()) {
        toast.error('Please provide a template name')
        return
      }

      if (editorData.channel === 'email' && !editorData.email_subject?.trim()) {
        toast.error('Please provide an email subject line')
        return
      }

      if (editorData.channel === 'sms' && !editorData.sms_content?.trim()) {
        toast.error('Please provide SMS content')
        return
      }

      if ((editorData.channel === 'email' || editorData.channel === 'physical') && !editorData.html_content?.trim()) {
        toast.error('Please provide template content')
        return
      }
      
      // Clean the data - only include fields that should be updated
      const templateData = {
        name: editorData.name,
        channel: editorData.channel,
        email_subject: editorData.email_subject,
        sms_content: editorData.sms_content,
        html_content: editorData.html_content,
        is_default: editorData.is_default,
        updated_at: new Date().toISOString()
      }
      
      // For new templates, add creation fields
      if (!isEditing) {
        templateData.created_by = profile?.id
        templateData.agency_id = agency?.id
      }
      
      console.log('[Template Update] Clean template data:', templateData)

      let result
      if (isEditing && selectedTemplate) {
        const templateId = typeof selectedTemplate === 'string' ? selectedTemplate : selectedTemplate.id
        console.log('[Template Update] Updating existing template:', templateId)
        console.log('[Template Update] Template data being sent:', templateData)
        
        result = await supabase
          .from('templates')
          .update(templateData)
          .eq('id', templateId)
          .select() // Add select to get back the updated data
          
        console.log('[Template Update] Full update result:', result)
        console.log('[Template Update] Update data returned:', result.data)
        console.log('[Template Update] Update error (if any):', result.error)
        console.log('[Template Update] Update status code:', result.status)
        console.log('[Template Update] Update statusText:', result.statusText)
      } else {
        console.log('[Template Update] Creating new template')
        result = await supabase
          .from('templates')
          .insert(templateData)
          .select() // Add select to get back the inserted data
        console.log('[Template Update] Insert result:', result)
      }

      if (result.error) {
        console.error('[Template Update] Database error details:', {
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
          code: result.error.code
        })
        throw result.error
      }

      if (!result.data || result.data.length === 0) {
        console.error('[Template Update] No data returned from update operation')
        throw new Error('Update operation completed but no data was returned. This may indicate an RLS policy issue.')
      }

      console.log('[Template Update] Save successful, showing toast and refreshing')
      toast.success(isEditing ? 'Template updated successfully' : 'Template created successfully')
      
      console.log('[Template Update] Fetching templates...')
      await fetchTemplates()
      
      console.log('[Template Update] Closing editor...')
      setShowEditor(false)
      resetEditor()
    } catch (error) {
      console.error('[Template Update] Error saving template:', error)
      toast.error('Failed to save template: ' + (error.message || 'Unknown error'))
    }
  }

  const resetEditor = () => {
    setEditorData({
      name: '',
      email_subject: '',
      sms_content: '',
      html_content: '',
      channel: 'email',
      is_default: false
    })
    setSelectedTemplate(null)
    setIsEditing(false)
    setPreviewMode(false)
  }

  const openEditor = (template = null) => {
    console.log('Opening editor with template:', template)
    if (template) {
      console.log('Setting editing mode with template:', template.id, template.name)
      setEditorData(template)
      setSelectedTemplate(template)
      setIsEditing(true)
    } else {
      console.log('Creating new template')
      resetEditor()
    }
    setShowEditor(true)
  }

  // Filter templates by channel
  const filteredTemplates = filterChannel === 'all' 
    ? templates 
    : templates.filter(template => template.channel === filterChannel)

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="mt-2 text-gray-600">Manage your communication templates for automated campaigns</p>
        </div>
        {/* Filter and Create Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Template Library</h2>
            <Button onClick={() => openEditor()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
          
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setFilterChannel('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                filterChannel === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Templates ({templates.length})
            </button>
            {channelOptions.map((option) => {
              const Icon = option.icon
              const count = templates.filter(t => t.channel === option.value).length
              return (
                <button
                  key={option.value}
                  onClick={() => setFilterChannel(option.value)}
                  disabled={!option.enabled}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                    filterChannel === option.value
                      ? 'bg-blue-600 text-white'
                      : option.enabled 
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {option.label} ({count})
                  {!option.enabled && <Crown className="w-3 h-3" />}
                </button>
              )
            })}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Email Templates</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{templates.filter(t => t.channel === 'email').length}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">SMS Templates</span>
              </div>
              <div className="text-2xl font-bold text-green-900">{templates.filter(t => t.channel === 'sms').length}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mailbox className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Physical Mail</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">{templates.filter(t => t.channel === 'physical').length}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Total Active</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{templates.length}</div>
            </div>
          </div>
        </div>


        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const channelInfo = getChannelInfo(template.channel)
            const ChannelIcon = channelInfo.icon
            
            const getChannelIconBg = (channel) => {
              switch(channel) {
                case 'email': return 'background: #dbeafe; color: #2563eb;'
                case 'sms': return 'background: #dcfce7; color: #16a34a;'
                case 'physical': return 'background: #f3e8ff; color: #9333ea;'
                default: return 'background: #f3f4f6; color: #6b7280;'
              }
            }
            
            const getChannelIcon = (channel) => {
              switch(channel) {
                case 'email': return '✉️'
                case 'sms': return '💬'
                case 'physical': return '📮'
                default: return '📄'
              }
            }
            
            return (
              <div
                key={template.id}
                className="relative bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-gray-200"
                onClick={() => openEditor(template)}
              >
                
                {/* Template Header */}
                <div className="flex items-start gap-4 mb-5">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ ...Object.fromEntries(getChannelIconBg(template.channel).split(';').map(s => s.split(':').map(p => p.trim()))) }}
                  >
                    {getChannelIcon(template.channel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{template.name}</h3>
                    <div className="text-sm text-gray-600 capitalize">{template.channel} template</div>
                  </div>
                </div>
                
                {/* Template Status */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-600">Active • Ready to use</span>
                </div>
                
                {/* Content Preview */}
                <div className="border-t border-gray-200 pt-5 mb-5">
                  <div className="space-y-3">
                    {template.channel === 'email' && template.email_subject && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">SUBJECT LINE</div>
                        <div className="text-sm text-gray-900 truncate">{template.email_subject}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">CONTENT PREVIEW</div>
                      <div className="text-sm text-gray-700 line-clamp-2">
                        {template.channel === 'sms' 
                          ? template.sms_content?.substring(0, 80) + (template.sms_content?.length > 80 ? '...' : '') 
                          : template.html_content?.replace(/<[^>]*>/g, '').substring(0, 80) + (template.html_content?.length > 80 ? '...' : '')
                        }
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Created {new Date(template.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 border-t border-gray-200 pt-5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedTemplate(template)
                      setPreviewMode(true)
                      setShowEditor(true)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditor(template)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                  {canDeleteContent() && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openDeleteModal(template)
                      }}
                      className="flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2 px-3 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

        </div>
        
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filterChannel === 'all' ? 'No Templates Yet' : `No ${getChannelInfo(filterChannel).label} Templates`}
            </h3>
            <p className="text-gray-600 mb-6">
              {filterChannel === 'all' 
                ? 'Create your first template to get started with automated communications'
                : `Create your first ${getChannelInfo(filterChannel).label.toLowerCase()} template`
              }
            </p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => openEditor()} 
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create First Template
              </button>
              {filterChannel === 'all' && (
                <button 
                  onClick={loadSampleTemplates}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Load Sample Templates
                </button>
              )}
              {filterChannel !== 'all' && (
                <button 
                  onClick={() => setFilterChannel('all')} 
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  View All Templates
                </button>
              )}
            </div>
          </div>
        )}

        {/* Template Editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setShowEditor(false); resetEditor() }}>
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">
                  {previewMode ? 'Preview Template' : (isEditing ? 'Edit Template' : 'Create New Template')}
                </h3>
                <button 
                  onClick={() => { setShowEditor(false); resetEditor() }}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">

                {!previewMode ? (
                  <div className="space-y-6">
                    {/* SMS Restriction Banner */}
                    {editorData.channel === 'sms' && !smsEnabled && (
                      <PlanRestrictionBanner
                        planName={currentPlan}
                        featureName="sms"
                        upgradeMessage={getUpgradeMessage(currentPlan, 'sms')}
                        className="mb-4"
                      />
                    )}

                    {/* Template Basic Info */}
                    <div className="bg-gray-50 rounded-xl p-6 mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-blue-600" />
                        Template Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Template Name
                          </label>
                          <input
                            type="text"
                            value={editorData.name}
                            onChange={(e) => setEditorData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="e.g., 'First Notice Demand Letter'"
                            disabled={editorData.channel === 'sms' && !smsEnabled}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Communication Channel
                          </label>
                          <div className="relative">
                            <select
                              value={editorData.channel}
                              onChange={(e) => setEditorData(prev => ({ ...prev, channel: e.target.value }))}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-all"
                            >
                              {channelOptions.map(option => (
                                <option 
                                  key={option.value} 
                                  value={option.value}
                                  disabled={!option.enabled}
                                >
                                  {option.label} {!option.enabled ? '(Upgrade Required)' : ''}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                          {editorData.channel === 'sms' && !smsEnabled && (
                            <div className="flex items-center mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                              <Crown className="w-4 h-4 mr-2" />
                              Upgrade to Professional to create SMS templates
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Email Subject (for email channel) */}
                    {editorData.channel === 'email' && (
                      <div className="bg-blue-50 rounded-xl p-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <Mail className="w-5 h-5 mr-2 text-blue-600" />
                          Email Settings
                        </h3>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Email Subject Line
                          </label>
                          <input
                            type="text"
                            value={editorData.email_subject}
                            onChange={(e) => setEditorData(prev => ({ ...prev, email_subject: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                            placeholder="e.g., 'Urgent: Payment Required for Account Balance'"
                          />
                          <p className="text-xs text-gray-500 mt-2">💡 Tip: Use clear, professional language that conveys urgency</p>
                        </div>
                      </div>
                    )}

                    {/* Content Area */}
                    <div className="bg-gray-50 rounded-xl p-6 mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        {editorData.channel === 'sms' ? (
                          <><Smartphone className="w-5 h-5 mr-2 text-green-600" />SMS Content</>
                        ) : editorData.channel === 'email' ? (
                          <><Mail className="w-5 h-5 mr-2 text-blue-600" />Email Content</>
                        ) : (
                          <><FileText className="w-5 h-5 mr-2 text-purple-600" />Letter Content</>
                        )}
                      </h3>
                      
                      {editorData.channel === 'sms' ? (
                        <div className="relative">
                          <div className="mb-2 flex items-center justify-between">
                            <label className="block text-sm font-semibold text-gray-700">
                              SMS Message
                            </label>
                            <span className="text-xs text-gray-500">
                              {editorData.sms_content?.length || 0}/160 characters
                            </span>
                          </div>
                          <textarea
                            value={editorData.sms_content}
                            onChange={(e) => setEditorData(prev => ({ ...prev, sms_content: e.target.value }))}
                            rows={4}
                            maxLength={160}
                            className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all ${
                              !smsEnabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            placeholder={smsEnabled ? "Hi {{name}}, you have an outstanding balance of ${{balance}}. Please call {{company_phone}} to resolve. Reply STOP to opt out." : "Upgrade to Professional to create SMS templates"}
                            disabled={!smsEnabled}
                          />
                          {!smsEnabled && (
                            <div className="absolute inset-0 bg-amber-50/90 rounded-xl flex items-center justify-center backdrop-blur-sm">
                              <div className="text-center bg-white rounded-lg p-4 shadow-lg">
                                <Crown className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                                <p className="text-sm text-amber-700 font-semibold">SMS templates require Professional plan</p>
                                <p className="text-xs text-amber-600 mt-1">Upgrade to unlock SMS messaging</p>
                              </div>
                            </div>
                          )}
                          <div className="mt-3 bg-green-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-800 mb-2">📱 SMS Requirements (Twilio Compatible):</p>
                            <ul className="text-xs text-green-700 space-y-1">
                              <li>• Must include opt-out instructions (Reply STOP)</li>
                              <li>• Keep under 160 characters for single message</li>
                              <li>• Include company identification</li>
                              <li>• Must state this is from a debt collector</li>
                            </ul>
                          </div>
                        </div>
                      ) : editorData.channel === 'email' ? (
                        <div>
                          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm font-semibold text-blue-800 mb-2">📧 Email Template Builder (SendGrid Compatible)</p>
                            <p className="text-xs text-blue-700">Create professional HTML emails without coding. Your content will be automatically formatted for optimal delivery.</p>
                          </div>
                          
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Email Message Content
                          </label>
                          <textarea
                            value={editorData.html_content}
                            onChange={(e) => setEditorData(prev => ({ ...prev, html_content: e.target.value }))}
                            rows={12}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                            placeholder="Write your email content here using simple text. Variables will be automatically replaced when sent.

Example:
Dear {{debtor_name}},

We would like to bring to your attention that we have not yet received payment for the outstanding amount of ${{balance}} relating to your account. The payment was originally due on {{due_date}} and is now considered past due.

To settle your overdue balance conveniently and securely, please make your payment online: {{payment_link}}

Alternatively, you may mail your payment to:
{{company_name}}
{{company_address}}
{{company_city}}, {{company_state}}, {{company_zip}}

If you have any inquiries, please contact {{contact_name}} at {{contact_email}} or {{contact_phone}}.

We appreciate your prompt attention to this matter.

Best regards,
{{contact_name}}
{{company_name}}"
                          />
                          <div className="mt-3 bg-blue-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-800 mb-2">✨ Features Automatically Added:</p>
                            <ul className="text-xs text-blue-700 space-y-1">
                              <li>• Professional HTML formatting</li>
                              <li>• Mobile-responsive design</li>
                              <li>• Company branding and headers</li>
                              <li>• Payment buttons and links</li>
                              <li>• Legal disclaimers and compliance text</li>
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="mb-4 p-4 bg-purple-50 rounded-lg">
                            <p className="text-sm font-semibold text-purple-800 mb-2">📮 Physical Mail Template (Lob Compatible)</p>
                            <p className="text-xs text-purple-700">Create professional demand letters that will be automatically formatted for printing and mailing.</p>
                          </div>
                          
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Letter Content
                          </label>
                          <textarea
                            value={editorData.html_content}
                            onChange={(e) => setEditorData(prev => ({ ...prev, html_content: e.target.value }))}
                            rows={12}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                            placeholder="Write your formal demand letter content here. Professional formatting will be applied automatically.

Example:
Dear {{name}},

This letter serves as formal notice that you have an outstanding debt in the amount of ${{balance}}.

You are hereby demanded to pay the above amount within thirty (30) days from the date of this letter.

If you believe this debt is not yours or you dispute the amount, you must notify us in writing within thirty (30) days.

To resolve this matter immediately, please contact our office at {{company_phone}}.

Sincerely,
{{collector_name}}
{{company_name}}"
                          />
                          <div className="mt-3 bg-purple-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-purple-800 mb-2">🏛️ Professional Features Included:</p>
                            <ul className="text-xs text-purple-700 space-y-1">
                              <li>• Official letterhead with company information</li>
                              <li>• Proper legal formatting and spacing</li>
                              <li>• Required debt collection disclosures</li>
                              <li>• Professional signature blocks</li>
                              <li>• Compliance with federal and state regulations</li>
                              <li>• Print-ready PDF generation via Lob API</li>
                            </ul>
                          </div>
                        </div>
                      )}
                      
                      {/* Universal Variables Section */}
                      <div className="mt-4 bg-gray-100 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-800 mb-2">🔧 Available Variables:</p>
                        
                        <div className="mb-3">
                          <p className="text-xs font-medium text-blue-800 mb-1">👤 Debtor Information (from uploaded data):</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{debtor_name}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{balance}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{debtor_email}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{debtor_phone}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{debtor_address}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{debtor_city}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{debtor_state}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{debtor_zip}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{account_number}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{due_date}}'}</code>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded">{'{{days_past_due}}'}</code>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-green-800 mb-1">🏢 Company Information (from settings page):</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{company_name}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{company_address}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{company_city}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{company_state}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{company_zip}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{contact_name}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{contact_email}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{contact_phone}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{contact_title}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{payment_link}}'}</code>
                            <code className="bg-green-50 text-green-800 px-2 py-1 rounded">{'{{current_date}}'}</code>
                          </div>
                        </div>
                      </div>
                    </div>


                    {/* Action Buttons */}
                    <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                      <div className="text-sm text-gray-500">
                        💾 Your template will be saved automatically
                      </div>
                      <div className="flex space-x-3">
                        <Button
                          variant="outline"
                          className="border-gray-300 hover:bg-gray-50"
                          onClick={() => {
                            setShowEditor(false)
                            resetEditor()
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={saveTemplate}
                          disabled={editorData.channel === 'sms' && !smsEnabled}
                          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {isEditing ? '✅ Update Template' : '🚀 Create Template'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Preview Mode */
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">Template: {selectedTemplate?.name}</h3>
                      <p className="text-sm text-gray-600">Channel: {getChannelInfo(selectedTemplate?.channel).label}</p>
                      {selectedTemplate?.channel === 'email' && (
                        <p className="text-sm text-gray-600">Subject: {selectedTemplate?.email_subject}</p>
                      )}
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Content Preview:</h4>
                      <div className="prose max-w-none">
                        {selectedTemplate?.channel === 'sms' ? (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm">{selectedTemplate?.sms_content}</p>
                          </div>
                        ) : (
                          <div dangerouslySetInnerHTML={{ __html: selectedTemplate?.html_content }} />
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-6 border-t">
                      <Button
                        variant="outline"
                        onClick={() => setPreviewMode(false)}
                      >
                        Edit Template
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowEditor(false)
                          resetEditor()
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && templateToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Delete Template</h3>
                </div>
                
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete &quot;{templateToDelete.name}&quot;? This action cannot be undone.
                </p>
                
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteModal(false)
                      setTemplateToDelete(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDelete(templateToDelete.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Template
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <TemplatesContent />
      </AppLayout>
    </ProtectedRoute>
  )
} 