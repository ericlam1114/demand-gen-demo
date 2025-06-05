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
  const { canDeleteContent, profile } = useAuth()
  const agency = profile?.agencies
  const currentPlan = agency?.plan || 'free'
  
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
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
    if (profile?.agency_id) {
      fetchTemplates()
    }
  }, [profile?.agency_id])

  const fetchTemplates = async () => {
    try {
      console.log('[Templates] Fetching templates for agency:', profile?.agency_id)
      
      if (!profile?.agency_id) {
        console.log('[Templates] No agency_id found, skipping fetch')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('agency_id', profile.agency_id)
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
        agency_id: profile?.agency_id
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
          <h1 className="text-3xl font-bold text-gray-900">Communication Templates</h1>
          <p className="mt-2 text-gray-600">Create and manage demand letter templates for email, SMS, and physical mail</p>
          
          {/* Channel Filter */}
          <div className="mt-6 flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Filter by channel:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilterChannel('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filterChannel === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Templates
              </button>
              {channelOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    onClick={() => setFilterChannel(option.value)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center space-x-1 ${
                      filterChannel === option.value
                        ? `bg-${option.color}-600 text-white`
                        : `bg-${option.color}-100 text-${option.color}-700 hover:bg-${option.color}-200`
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Create New Template Button */}
        <div className="mb-6">
          <Button onClick={() => openEditor()} className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create New Template</span>
          </Button>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const channelInfo = getChannelInfo(template.channel)
            const ChannelIcon = channelInfo.icon
            
            return (
              <div key={template.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 bg-${channelInfo.color}-100 rounded-lg flex items-center justify-center`}>
                        <ChannelIcon className={`w-5 h-5 text-${channelInfo.color}-600`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-500">{channelInfo.label}</p>
                      </div>
                    </div>
                    {template.is_default && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        Default
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Subject:</span>
                      <span className="text-gray-600 ml-1">{template.email_subject}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Created {new Date(template.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedTemplate(template)
                        setPreviewMode(true)
                        setShowEditor(true)
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => openEditor(template)}
                    >
                      <Edit3 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    {canDeleteContent() && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700"
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

          {/* Empty State */}
          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Found</h3>
              <p className="text-gray-600 mb-6">
                Create your first email template to get started with automated demand letters.
              </p>
              <Button onClick={() => openEditor()}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Template
              </Button>
            </div>
          )}
        </div>

        {/* Template Editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {previewMode ? 'Preview Template' : (isEditing ? 'Edit Template' : 'Create New Template')}
                  </h2>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditor(false)
                      resetEditor()
                    }}
                  >
                    ✕
                  </Button>
                </div>

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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Template Name
                        </label>
                        <input
                          type="text"
                          value={editorData.name}
                          onChange={(e) => setEditorData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter template name"
                          disabled={editorData.channel === 'sms' && !smsEnabled}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Channel
                        </label>
                        <select
                          value={editorData.channel}
                          onChange={(e) => setEditorData(prev => ({ ...prev, channel: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
                        {editorData.channel === 'sms' && !smsEnabled && (
                          <div className="flex items-center mt-1 text-xs text-amber-600">
                            <Crown className="w-3 h-3 mr-1" />
                            Upgrade to Professional to create SMS templates
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Email Subject (for email channel) */}
                    {editorData.channel === 'email' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Subject
                        </label>
                        <input
                          type="text"
                          value={editorData.email_subject}
                          onChange={(e) => setEditorData(prev => ({ ...prev, email_subject: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter email subject"
                        />
                      </div>
                    )}

                    {/* Content Area */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {editorData.channel === 'sms' ? 'SMS Content' : 'Content'}
                      </label>
                      {editorData.channel === 'sms' ? (
                        <div className="relative">
                          <textarea
                            value={editorData.sms_content}
                            onChange={(e) => setEditorData(prev => ({ ...prev, sms_content: e.target.value }))}
                            rows={4}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                              !smsEnabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            placeholder={smsEnabled ? "Enter SMS content" : "Upgrade to Professional to create SMS templates"}
                            disabled={!smsEnabled}
                          />
                          {!smsEnabled && (
                            <div className="absolute inset-0 bg-amber-50/80 rounded-md flex items-center justify-center">
                              <div className="text-center">
                                <Crown className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                                <p className="text-sm text-amber-700 font-medium">SMS templates require Professional plan</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <textarea
                          value={editorData.html_content}
                          onChange={(e) => setEditorData(prev => ({ ...prev, html_content: e.target.value }))}
                          rows={10}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter your template content here..."
                        />
                      )}
                    </div>

                    {/* Default Template Checkbox */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_default"
                        checked={editorData.is_default}
                        onChange={(e) => setEditorData(prev => ({ ...prev, is_default: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        disabled={editorData.channel === 'sms' && !smsEnabled}
                      />
                      <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">
                        Set as default template for this channel
                      </label>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3 pt-6 border-t">
                      <Button
                        variant="outline"
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
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {isEditing ? 'Update Template' : 'Create Template'}
                      </Button>
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