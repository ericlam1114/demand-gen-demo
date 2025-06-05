'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Building2, User, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [agencies, setAgencies] = useState([])
  const [formData, setFormData] = useState({
    full_name: '',
    agency_id: '',
    role: 'user'
  })
  const { user, loadUserProfile } = useAuth()
  const router = useRouter()

  useEffect(() => {
    fetchAgencies()
  }, [])

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('name')

      if (error) throw error
      setAgencies(data || [])
    } catch (error) {
      console.error('Error fetching agencies:', error)
      toast.error('Failed to load agencies')
    }
  }

  const handleComplete = async () => {
    if (!formData.full_name.trim()) {
      toast.error('Please enter your full name')
      return
    }

    if (!formData.agency_id) {
      toast.error('Please select an agency')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: formData.full_name,
          role: formData.role,
          agency_id: formData.agency_id,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      toast.success('Profile completed successfully!')
      
      // Reload the user profile
      await loadUserProfile(user.id)
      
      // Redirect to dashboard
      router.push('/dashboard')

    } catch (error) {
      console.error('Error completing onboarding:', error)
      toast.error('Failed to complete setup')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to continue</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Complete Your Setup
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Just a few more details to get you started
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
                  value={user.email}
                  disabled
                />
              </div>

              <Button 
                onClick={() => setStep(2)}
                className="w-full"
                disabled={!formData.full_name.trim()}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Select Your Agency</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose your agency
                </label>
                <div className="space-y-2">
                  {agencies.map((agency) => (
                    <label
                      key={agency.id}
                      className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                        formData.agency_id === agency.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="agency"
                        value={agency.id}
                        checked={formData.agency_id === agency.id}
                        onChange={(e) => setFormData({ ...formData, agency_id: e.target.value })}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{agency.name}</h4>
                          <p className="text-sm text-gray-500 capitalize">{agency.plan} Plan</p>
                        </div>
                        {formData.agency_id === agency.id && (
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <Button 
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleComplete}
                  className="flex-1"
                  disabled={!formData.agency_id || loading}
                >
                  {loading ? 'Setting up...' : 'Complete Setup'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Need help? Contact your administrator
          </p>
        </div>
      </div>
    </div>
  )
} 