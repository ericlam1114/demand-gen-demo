'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/AuthProvider'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Palette, 
  FileText,
  Save,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

function SettingsContent() {
  const { profile, agency, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState({
    company_name: '',
    company_address: '',
    company_city: '',
    company_state: '',
    company_zip: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    license_number: '',
    from_email: '',
    from_name: '',
    reply_to_email: '',
    letter_footer: '',
    legal_disclaimer: '',
    primary_color: '#2563eb',
    secondary_color: '#64748b'
  })
  
  const [loading, setLoading] = useState(false) // Start with false, only true while fetching
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchSettings = async () => {
    setLoading(true)
    try {
      console.log('[Settings] Fetching settings for agency:', agency?.id)
      
      if (!agency?.id) {
        console.log('[Settings] No agency id found, showing error')
        setError('No agency access. Please log in with a valid account.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('agency_id', agency.id)
        .limit(1)

      console.log('[Settings] Query result:', { hasData: !!data, dataLength: data?.length, error })

      if (error) {
        console.error('[Settings] Error fetching settings:', error)
        setError('Failed to load settings. Please try again.')
      } else {
        // Handle both array result and potential empty array
        const settingsData = Array.isArray(data) ? data[0] : data
        if (settingsData) {
        // Ensure all values are strings, not null
          const cleanedData = Object.keys(settingsData).reduce((acc, key) => {
            acc[key] = settingsData[key] ?? ''
          return acc
        }, {})
        setSettings(cleanedData)
        } else {
          console.log('[Settings] No settings found for agency - will create on save')
          // Keep default empty settings
        }
      }
    } catch (error) {
      console.error('[Settings] Error fetching settings:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('[Settings] useEffect running:', { authLoading, agencyId: agency?.id })
    
    // If auth is still loading, don't do anything yet
    if (authLoading) {
      return
    }
    
    // Auth is done loading
    if (agency?.id) {
      fetchSettings()
    } else {
      // No agency found after auth loaded
      setError('No agency access. Please log in with a valid account.')
      setLoading(false)
    }
  }, [agency?.id, authLoading])

  const saveSettings = async () => {
    setSaving(true)
    try {
      // Check if settings already exist - remove .single() to avoid 406 error
      const { data: existingSettings } = await supabase
        .from('company_settings')
        .select('id')
        .eq('agency_id', agency.id)
        .limit(1)

      // Handle array result properly
      const hasExisting = existingSettings && existingSettings.length > 0
      const existingId = hasExisting ? existingSettings[0].id : null

      let result
      if (hasExisting && existingId) {
        // Update existing
        console.log('[Settings] Updating existing settings:', existingId)
        result = await supabase
          .from('company_settings')
          .update({
            ...settings,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingId)
      } else {
        // Insert new
        console.log('[Settings] Creating new settings for agency:', agency.id)
        result = await supabase
          .from('company_settings')
          .insert({
            ...settings,
            agency_id: agency.id,
            created_by: profile.id
          })
      }

      if (result.error) throw result.error

      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  // Show loading state while auth is loading or settings are loading
  if (authLoading || loading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show error state if no agency access
  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-800 mb-2">Access Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
          <p className="mt-2 text-gray-600">Configure your collections agency information and branding</p>
        </div>

        <div className="space-y-8">
          {/* Company Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Building2 className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Company Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={settings.company_name ?? ''}
                  onChange={(e) => updateSetting('company_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your Collections Agency"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                <input
                  type="text"
                  value={settings.license_number ?? ''}
                  onChange={(e) => updateSetting('license_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="CA-12345"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={settings.company_address ?? ''}
                  onChange={(e) => updateSetting('company_address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Business Center Dr"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={settings.company_city ?? ''}
                  onChange={(e) => updateSetting('company_city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Los Angeles"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={settings.company_state ?? ''}
                  onChange={(e) => updateSetting('company_state', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="CA"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                <input
                  type="text"
                  value={settings.company_zip ?? ''}
                  onChange={(e) => updateSetting('company_zip', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="90210"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={settings.company_phone ?? ''}
                  onChange={(e) => updateSetting('company_phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={settings.company_website ?? ''}
                  onChange={(e) => updateSetting('company_website', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://yourcompany.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={settings.company_email ?? ''}
                  onChange={(e) => updateSetting('company_email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@yourcompany.com"
                />
              </div>
            </div>
          </div>

          {/* Email Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Mail className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Email Settings</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                <input
                  type="email"
                  value={settings.from_email}
                  onChange={(e) => updateSetting('from_email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="collections@yourcompany.com"
                />
                <p className="text-xs text-gray-500 mt-1">Email address used to send demand letters</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                <input
                  type="text"
                  value={settings.from_name}
                  onChange={(e) => updateSetting('from_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your Collections Agency"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reply To Email</label>
                <input
                  type="email"
                  value={settings.reply_to_email}
                  onChange={(e) => updateSetting('reply_to_email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="replies@yourcompany.com"
                />
              </div>
            </div>
          </div>

          {/* Legal Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <FileText className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Legal & Compliance</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Letter Footer</label>
                <textarea
                  value={settings.letter_footer}
                  onChange={(e) => updateSetting('letter_footer', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="This communication is from a debt collector..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legal Disclaimer</label>
                <textarea
                  value={settings.legal_disclaimer}
                  onChange={(e) => updateSetting('legal_disclaimer', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Unless you notify this office within 30 days..."
                />
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Palette className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Branding</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={settings.primary_color}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.primary_color}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={settings.secondary_color}
                    onChange={(e) => updateSetting('secondary_color', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.secondary_color}
                    onChange={(e) => updateSetting('secondary_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving} className="px-6">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <SettingsContent />
      </AppLayout>
    </ProtectedRoute>
  )
} 