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
  Crown
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

  const saveTemplate = async () => {
    try {
      const templateData = {
        ...editorData,
        created_by: profile?.id,
        agency_id: agency?.id
      }

      let result
      if (isEditing && selectedTemplate) {
        result = await supabase
          .from('templates')
          .update(templateData)
          .eq('id', selectedTemplate.id)
      } else {
        result = await supabase
          .from('templates')
          .insert(templateData)
      }

      if (result.error) throw result.error

      toast.success(isEditing ? 'Template updated successfully' : 'Template created successfully')
      fetchTemplates()
      setShowEditor(false)
      resetEditor()
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Failed to save template')
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
    if (template) {
      setEditorData(template)
      setSelectedTemplate(template)
      setIsEditing(true)
    } else {
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
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Communication Templates</h1>
                <p className="text-blue-100 text-lg">Create powerful demand letter templates for email, SMS, and physical mail</p>
                <div className="flex items-center mt-4 space-x-6 text-sm">
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    <span>{templates.filter(t => t.channel === 'email').length} Email</span>
                  </div>
                  <div className="flex items-center">
                    <Smartphone className="w-4 h-4 mr-2" />
                    <span>{templates.filter(t => t.channel === 'sms').length} SMS</span>
                  </div>
                  <div className="flex items-center">
                    <Mailbox className="w-4 h-4 mr-2" />
                    <span>{templates.filter(t => t.channel === 'physical').length} Physical</span>
                  </div>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <FileText className="w-12 h-12 text-white/80 mx-auto mb-2" />
                  <p className="text-sm text-center text-blue-100">Total Templates</p>
                  <p className="text-2xl font-bold text-center">{templates.length}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Enhanced Channel Filter */}
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Filter by channel:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setFilterChannel('all')}
                    className={`px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
                      filterChannel === 'all'
                        ? 'bg-gray-900 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
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
                        className={`px-4 py-2 text-sm rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                          filterChannel === option.value
                            ? `bg-${option.color}-600 text-white shadow-md`
                            : option.enabled 
                              ? `bg-${option.color}-50 text-${option.color}-700 hover:bg-${option.color}-100 hover:shadow-sm border border-${option.color}-200`
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{option.label} ({count})</span>
                        {!option.enabled && <Crown className="w-3 h-3" />}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Button onClick={() => openEditor()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </div>
          </div>
        </div>


        {/* Templates Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const channelInfo = getChannelInfo(template.channel)
            const ChannelIcon = channelInfo.icon
            
            return (
              <div key={template.id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-gray-200 group">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 bg-gradient-to-br from-${channelInfo.color}-100 to-${channelInfo.color}-200 rounded-xl flex items-center justify-center shadow-sm`}>
                        <ChannelIcon className={`w-6 h-6 text-${channelInfo.color}-600`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{template.name}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full bg-${channelInfo.color}-100 text-${channelInfo.color}-700`}>
                            {channelInfo.label}
                          </span>
                          {template.is_default && (
                            <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                              ⭐ Default
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {template.channel === 'email' && template.email_subject && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">EMAIL SUBJECT</p>
                        <p className="text-sm text-gray-900 truncate">{template.email_subject}</p>
                      </div>
                    )}
                    
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">CONTENT PREVIEW</p>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {template.channel === 'sms' 
                          ? template.sms_content?.substring(0, 100) + (template.sms_content?.length > 100 ? '...' : '') 
                          : template.html_content?.replace(/<[^>]*>/g, '').substring(0, 100) + (template.html_content?.length > 100 ? '...' : '')
                        }
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Created {new Date(template.created_at).toLocaleDateString()}</span>
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
                      onClick={() => {
                        setSelectedTemplate(template)
                        setPreviewMode(true)
                        setShowEditor(true)
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      onClick={() => openEditor(template)}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    {canDeleteContent() && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300 transition-all"
                        onClick={() => openDeleteModal(template)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Enhanced Empty State */}
          {filteredTemplates.length === 0 && (
            <div className="col-span-full">
              <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border-2 border-dashed border-gray-300">
                <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <FileText className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {filterChannel === 'all' ? 'No Templates Created Yet' : `No ${getChannelInfo(filterChannel).label} Templates`}
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {filterChannel === 'all' 
                    ? 'Create your first template to get started with automated demand letters. Choose from email, SMS, or physical mail options.'
                    : `Create your first ${getChannelInfo(filterChannel).label.toLowerCase()} template to send ${getChannelInfo(filterChannel).label.toLowerCase()} communications.`
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => openEditor()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Template
                  </Button>
                  {filterChannel !== 'all' && (
                    <Button variant="outline" onClick={() => setFilterChannel('all')} className="border-gray-300">
                      View All Templates
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Template Editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {previewMode ? '👁️ Preview Template' : (isEditing ? '✏️ Edit Template' : '✨ Create New Template')}
                    </h2>
                    <p className="text-blue-100 mt-1">
                      {previewMode ? 'Review your template content' : (isEditing ? 'Update your template details' : 'Design a powerful communication template')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    onClick={() => {
                      setShowEditor(false)
                      resetEditor()
                    }}
                  >
                    ✕
                  </Button>
                </div>
              </div>
              
              <div className="p-8 overflow-y-auto max-h-[calc(95vh-120px)]">

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
                        ) : (
                          <><FileText className="w-5 h-5 mr-2 text-purple-600" />Template Content</>
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
                            placeholder={smsEnabled ? "Your account balance is overdue. Please contact us to arrange payment. Reply STOP to opt out." : "Upgrade to Professional to create SMS templates"}
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
                          <p className="text-xs text-gray-500 mt-2">💡 Tip: Keep SMS messages concise and include opt-out instructions</p>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Template Content
                          </label>
                          <textarea
                            value={editorData.html_content}
                            onChange={(e) => setEditorData(prev => ({ ...prev, html_content: e.target.value }))}
                            rows={12}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all font-mono text-sm"
                            placeholder="Dear {{name}},\n\nWe are writing to inform you of an outstanding balance on your account...\n\nTotal Amount Due: {{balance}}\n\nPlease contact us immediately to resolve this matter.\n\nSincerely,\nCollections Department"
                          />
                          <div className="mt-3 bg-blue-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-800 mb-1">💡 Available Variables:</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{'{{name}}'}</code>
                              <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{'{{balance}}'}</code>
                              <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{'{{email}}'}</code>
                              <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{'{{state}}'}</code>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Default Template Checkbox */}
                    <div className="bg-yellow-50 rounded-xl p-6 mb-6">
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          id="is_default"
                          checked={editorData.is_default}
                          onChange={(e) => setEditorData(prev => ({ ...prev, is_default: e.target.checked }))}
                          className="h-5 w-5 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded mt-0.5"
                          disabled={editorData.channel === 'sms' && !smsEnabled}
                        />
                        <div>
                          <label htmlFor="is_default" className="block text-sm font-semibold text-gray-900">
                            ⭐ Set as default template
                          </label>
                          <p className="text-xs text-gray-600 mt-1">
                            Default templates are automatically used when creating new {editorData.channel} communications
                          </p>
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