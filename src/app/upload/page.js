'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/AuthProvider'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { 
  Database, 
  FileText, 
  Settings, 
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Link as LinkIcon,
  Upload,
  Download,
  MapPin,
  Mail,
  User,
  DollarSign,
  Calendar,
  Building
} from 'lucide-react'
import toast from 'react-hot-toast'

function DataSourcesContent() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('csv-mapping')
  const [columnMappings, setColumnMappings] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // CSV Column Mapping State
  const [newMapping, setNewMapping] = useState({
    csv_column: '',
    system_field: '',
    is_required: false,
    validation_rule: ''
  })

  // API Integration State
  const [newIntegration, setNewIntegration] = useState({
    provider: '',
    api_key: '',
    api_secret: '',
    endpoint_url: '',
    is_active: true
  })
  const [showApiKeys, setShowApiKeys] = useState({})

  // Standard system fields that CSV columns can map to
  const systemFields = [
    { value: 'name', label: 'Full Name', icon: User, required: true },
    { value: 'first_name', label: 'First Name', icon: User },
    { value: 'last_name', label: 'Last Name', icon: User },
    { value: 'email', label: 'Email Address', icon: Mail, required: true },
    { value: 'phone', label: 'Phone Number', icon: Mail },
    { value: 'address', label: 'Full Address', icon: MapPin },
    { value: 'street_address', label: 'Street Address', icon: MapPin },
    { value: 'city', label: 'City', icon: MapPin },
    { value: 'state', label: 'State/Province', icon: MapPin, required: true },
    { value: 'zip_code', label: 'ZIP/Postal Code', icon: MapPin },
    { value: 'country', label: 'Country', icon: MapPin },
    { value: 'balance', label: 'Outstanding Balance', icon: DollarSign, required: true },
    { value: 'original_amount', label: 'Original Amount', icon: DollarSign },
    { value: 'account_number', label: 'Account Number', icon: Building },
    { value: 'date_of_service', label: 'Date of Service', icon: Calendar },
    { value: 'last_payment_date', label: 'Last Payment Date', icon: Calendar }
  ]

  // Available integration providers
  const providers = [
    { value: 'zoho', label: 'Zoho CRM', description: 'Sync with Zoho CRM contacts and accounts' },
    { value: 'salesforce', label: 'Salesforce', description: 'Connect to Salesforce CRM' },
    { value: 'hubspot', label: 'HubSpot', description: 'Integrate with HubSpot CRM' },
    { value: 'mysql', label: 'MySQL Database', description: 'Connect to MySQL database' },
    { value: 'postgresql', label: 'PostgreSQL', description: 'Connect to PostgreSQL database' },
    { value: 'custom_api', label: 'Custom API', description: 'Connect to custom REST API' }
  ]

  const fetchData = useCallback(async () => {
    if (!profile?.agency_id) return
    
    setLoading(true)
    try {
      // Fetch CSV column mappings
      const mappingsResult = await supabase
        .from('csv_column_mappings')
        .select('*')
        .eq('agency_id', profile.agency_id)

      // Fetch API integrations  
      const integrationsResult = await supabase
        .from('api_integrations')
        .select('*')
        .eq('agency_id', profile.agency_id)

      // Handle case where tables don't exist yet
      setColumnMappings(mappingsResult?.data || [])
      setIntegrations(integrationsResult?.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      
      // If tables don't exist, create them by calling the API
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        try {
          const response = await fetch('/api/init-data-sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agency_id: profile.agency_id })
          })
          
          if (response.ok) {
            // Retry fetching after initialization
            setTimeout(() => fetchData(), 1000)
            return
          }
        } catch (initError) {
          console.error('Failed to initialize data sources:', initError)
        }
      }
      
      toast.error('Failed to load data sources')
    } finally {
      setLoading(false)
    }
  }, [profile, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveColumnMapping = async () => {
    if (!newMapping.csv_column || !newMapping.system_field) {
      toast.error('Please fill in CSV column and system field')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('csv_column_mappings')
        .insert({
          ...newMapping,
          agency_id: profile?.agency_id,
          created_by: profile?.id
        })

      if (error) throw error

      toast.success('Column mapping saved successfully')
      setNewMapping({
        csv_column: '',
        system_field: '',
        is_required: false,
        validation_rule: ''
      })
      fetchData()
    } catch (error) {
      console.error('Error saving mapping:', error)
      toast.error('Failed to save column mapping')
    } finally {
      setSaving(false)
    }
  }

  const deleteColumnMapping = async (id) => {
    try {
      const { error } = await supabase
        .from('csv_column_mappings')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Column mapping deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting mapping:', error)
      toast.error('Failed to delete mapping')
    }
  }

  const saveIntegration = async () => {
    if (!newIntegration.provider) {
      toast.error('Please select a provider')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('api_integrations')
        .insert({
          ...newIntegration,
          agency_id: profile?.agency_id,
          created_by: profile?.id
        })

      if (error) throw error

      toast.success('Integration saved successfully')
      setNewIntegration({
        provider: '',
        api_key: '',
        api_secret: '',
        endpoint_url: '',
        is_active: true
      })
      fetchData()
    } catch (error) {
      console.error('Error saving integration:', error)
      toast.error('Failed to save integration')
    } finally {
      setSaving(false)
    }
  }

  const deleteIntegration = async (id) => {
    try {
      const { error } = await supabase
        .from('api_integrations')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Integration deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting integration:', error)
      toast.error('Failed to delete integration')
    }
  }

  const toggleIntegrationStatus = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('api_integrations')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error

      toast.success(`Integration ${!currentStatus ? 'activated' : 'deactivated'}`)
      fetchData()
    } catch (error) {
      console.error('Error updating integration:', error)
      toast.error('Failed to update integration')
    }
  }

  const downloadSampleCSV = () => {
    const headers = columnMappings.map(mapping => mapping.csv_column).join(',')
    const sampleRow = columnMappings.map(mapping => {
      switch (mapping.system_field) {
        case 'name': return 'John Smith'
        case 'email': return 'john@example.com'
        case 'balance': return '1250.00'
        case 'state': return 'CA'
        case 'city': return 'Los Angeles'
        case 'address': return '123 Main St'
        case 'phone': return '555-123-4567'
        default: return 'Sample Data'
      }
    }).join(',')

    const csv = `${headers}\n${sampleRow}`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-upload-format.csv'
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success('Sample CSV downloaded')
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-32 bg-gray-200 rounded mb-6"></div>
            <div className="space-y-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Sources & Integrations</h1>
          <p className="mt-2 text-gray-600">Manage CSV column mappings and API integrations for automated data processing</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('csv-mapping')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'csv-mapping'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              CSV Column Mapping
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'integrations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <LinkIcon className="w-4 h-4 inline mr-2" />
              API Integrations
            </button>
          </nav>
        </div>

        {/* CSV Column Mapping Tab */}
        {activeTab === 'csv-mapping' && (
          <div className="space-y-8">
            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start">
                <AlertCircle className="w-6 h-6 text-blue-600 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-lg font-medium text-blue-900 mb-2">CSV Column Mapping</h3>
                  <p className="text-blue-700">
                    Map your CSV column headers to system fields so the platform knows how to process your data. 
                    This allows you to use CSVs with different column names (e.g., "Customer Name" instead of "name").
                  </p>
                </div>
              </div>
            </div>

            {/* Add New Mapping Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Column Mapping</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CSV Column Name
                  </label>
                  <input
                    type="text"
                    value={newMapping.csv_column}
                    onChange={(e) => setNewMapping(prev => ({ ...prev, csv_column: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Customer Name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    System Field
                  </label>
                  <select
                    value={newMapping.system_field}
                    onChange={(e) => setNewMapping(prev => ({ ...prev, system_field: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a field</option>
                    {systemFields.map(field => (
                      <option key={field.value} value={field.value}>
                        {field.label} {field.required ? '*' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validation Rule
                  </label>
                  <select
                    value={newMapping.validation_rule}
                    onChange={(e) => setNewMapping(prev => ({ ...prev, validation_rule: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">No validation</option>
                    <option value="email">Email format</option>
                    <option value="phone">Phone number</option>
                    <option value="currency">Currency amount</option>
                    <option value="date">Date format</option>
                    <option value="required">Required field</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    onClick={saveColumnMapping}
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Add Mapping
                  </Button>
                </div>
              </div>

              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="is_required"
                  checked={newMapping.is_required}
                  onChange={(e) => setNewMapping(prev => ({ ...prev, is_required: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_required" className="ml-2 block text-sm text-gray-900">
                  This is a required field
                </label>
              </div>
            </div>

            {/* Current Mappings */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Current Column Mappings</h3>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={downloadSampleCSV}
                    disabled={columnMappings.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Sample CSV
                  </Button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CSV Column
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        System Field
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Required
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Validation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {columnMappings.map((mapping) => {
                      const systemField = systemFields.find(f => f.value === mapping.system_field)
                      const Icon = systemField?.icon || Database
                      
                      return (
                        <tr key={mapping.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {mapping.csv_column}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <Icon className="w-4 h-4 mr-2 text-gray-400" />
                              {systemField?.label || mapping.system_field}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {mapping.is_required ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Required
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Optional
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {mapping.validation_rule || 'None'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteColumnMapping(mapping.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                
                {columnMappings.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No column mappings configured</h3>
                    <p className="text-gray-600">Add your first column mapping to get started with CSV uploads.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* API Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="space-y-8">
            {/* Info Card */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-start">
                <LinkIcon className="w-6 h-6 text-green-600 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-lg font-medium text-green-900 mb-2">API Integrations</h3>
                  <p className="text-green-700">
                    Connect to external systems like CRMs and databases to automatically sync debtor data. 
                    Configure your API credentials securely to enable real-time data synchronization.
                  </p>
                </div>
              </div>
            </div>

            {/* Add New Integration Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add API Integration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider
                  </label>
                  <select
                    value={newIntegration.provider}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, provider: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a provider</option>
                    {providers.map(provider => (
                      <option key={provider.value} value={provider.value}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                  {newIntegration.provider && (
                    <p className="text-sm text-gray-500 mt-1">
                      {providers.find(p => p.value === newIntegration.provider)?.description}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={newIntegration.api_key}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, api_key: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your API key"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Secret (if required)
                  </label>
                  <input
                    type="password"
                    value={newIntegration.api_secret}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, api_secret: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter API secret"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endpoint URL (if custom)
                  </label>
                  <input
                    type="url"
                    value={newIntegration.endpoint_url}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, endpoint_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://api.example.com/v1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={newIntegration.is_active}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Activate immediately
                  </label>
                </div>
                
                <Button
                  onClick={saveIntegration}
                  disabled={saving}
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add Integration
                </Button>
              </div>
            </div>

            {/* Current Integrations */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Current Integrations</h3>
              </div>
              
              <div className="divide-y divide-gray-200">
                {integrations.map((integration) => {
                  const provider = providers.find(p => p.value === integration.provider)
                  
                  return (
                    <div key={integration.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              integration.is_active ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              <Database className={`w-5 h-5 ${
                                integration.is_active ? 'text-green-600' : 'text-gray-400'
                              }`} />
                            </div>
                          </div>
                          <div className="ml-4">
                            <h4 className="text-lg font-medium text-gray-900">
                              {provider?.label || integration.provider}
                            </h4>
                            <p className="text-sm text-gray-500">{provider?.description}</p>
                            <div className="flex items-center mt-2 space-x-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                integration.is_active 
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {integration.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-xs text-gray-500">
                                Added {new Date(integration.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowApiKeys(prev => ({ 
                              ...prev, 
                              [integration.id]: !prev[integration.id] 
                            }))}
                          >
                            {showApiKeys[integration.id] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleIntegrationStatus(integration.id, integration.is_active)}
                            className={integration.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                          >
                            {integration.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteIntegration(integration.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {showApiKeys[integration.id] && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">API Key:</span>
                              <p className="text-gray-600 font-mono text-xs mt-1 break-all">
                                {integration.api_key}
                              </p>
                            </div>
                            {integration.api_secret && (
                              <div>
                                <span className="font-medium text-gray-700">API Secret:</span>
                                <p className="text-gray-600 font-mono text-xs mt-1 break-all">
                                  {integration.api_secret}
                                </p>
                              </div>
                            )}
                            {integration.endpoint_url && (
                              <div className="md:col-span-2">
                                <span className="font-medium text-gray-700">Endpoint URL:</span>
                                <p className="text-gray-600 font-mono text-xs mt-1 break-all">
                                  {integration.endpoint_url}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {integrations.length === 0 && (
                <div className="text-center py-12">
                  <LinkIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations configured</h3>
                  <p className="text-gray-600">Connect to external systems to automate your data workflow.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DataSourcesPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <DataSourcesContent />
      </AppLayout>
    </ProtectedRoute>
  )
} 