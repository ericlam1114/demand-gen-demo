'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/AuthProvider'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
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
  Mailbox
} from 'lucide-react'
import toast from 'react-hot-toast'

function TemplatesContent() {
  const { canDeleteContent, profile } = useAuth()
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

  const channelOptions = [
    { value: 'email', label: 'Email', icon: Mail, color: 'blue' },
    { value: 'sms', label: 'SMS', icon: Smartphone, color: 'green' },
    { value: 'physical', label: 'Physical Mail', icon: Mailbox, color: 'purple' }
  ]

  const getChannelInfo = (channel) => {
    return channelOptions.find(opt => opt.value === channel) || channelOptions[0]
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
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
                    <Button size="sm" variant="outline" className="flex-1">
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Edit3 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    {canDeleteContent() && (
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
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
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create First Template
              </Button>
            </div>
          )}
        </div>
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