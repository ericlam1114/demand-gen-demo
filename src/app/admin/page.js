'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { Building2, Users, Mail, Crown, Eye, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const { profile, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    fetchAgencies()
  }, [])

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select(`
          *,
          user_profiles (
            id,
            full_name,
            email,
            role,
            last_login_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgencies(data || [])
    } catch (error) {
      console.error('Error fetching agencies:', error)
      toast.error('Failed to load agencies')
    } finally {
      setLoading(false)
    }
  }

  const impersonateAgency = async (agencyId, agencyName) => {
    try {
      // Store the impersonation context in sessionStorage for this admin session
      sessionStorage.setItem('admin_impersonating', JSON.stringify({
        agencyId,
        agencyName,
        originalUserId: profile.id,
        originalUserEmail: profile.email
      }))
      
      toast.success(`Switched to ${agencyName} dashboard`)
      router.push('/dashboard')
    } catch (error) {
      console.error('Error switching agency:', error)
      toast.error('Failed to switch agency')
    }
  }

  const stopImpersonation = () => {
    sessionStorage.removeItem('admin_impersonating')
    toast.success('Returned to admin view')
    router.refresh()
  }

  // Check if currently impersonating
  const currentImpersonation = typeof window !== 'undefined' 
    ? JSON.parse(sessionStorage.getItem('admin_impersonating') || 'null')
    : null

  if (loading) {
    return (
      <ProtectedRoute requireAdmin={true}>
        <AppLayout>
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        </AppLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requireAdmin={true}>
      <AppLayout>
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <Crown className="w-8 h-8 text-yellow-500" />
                <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              </div>
              <p className="text-gray-600">
                Manage all agencies and switch between accounts. You have administrative access to all agencies.
              </p>
            </div>

            {/* Current Admin Info */}
            <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-6 rounded-lg mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Super Administrator</h3>
                    <p className="text-gray-600">
                      Logged in as: {profile?.full_name || profile?.email}
                    </p>
                  </div>
                </div>
                
                {currentImpersonation && (
                  <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <Eye className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">
                        Currently viewing: {currentImpersonation.agencyName}
                      </span>
                      <Button
                        onClick={stopImpersonation}
                        variant="outline"
                        size="sm"
                        className="ml-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                      >
                        Return to Admin
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agencies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agencies.map((agency) => (
                <div key={agency.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    {/* Agency Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{agency.name}</h3>
                          <p className="text-sm text-gray-500">@{agency.slug}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        agency.plan === 'enterprise' 
                          ? 'bg-purple-100 text-purple-800'
                          : agency.plan === 'professional'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {agency.plan}
                      </span>
                    </div>

                    {/* Agency Details */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Max Users:</span>
                        <span className="font-medium">{agency.max_users}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Letters/Month:</span>
                        <span className="font-medium">{agency.max_letters_per_month?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Active Users:</span>
                        <span className="font-medium">{agency.user_profiles?.length || 0}</span>
                      </div>
                    </div>

                    {/* Team Members Preview */}
                    {agency.user_profiles && agency.user_profiles.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          Team Members
                        </h4>
                        <div className="space-y-1">
                          {agency.user_profiles.slice(0, 3).map((user) => (
                            <div key={user.id} className="flex items-center space-x-2 text-xs">
                              <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                                <span className="text-gray-600 text-xs">
                                  {user.full_name?.charAt(0) || user.email?.charAt(0)}
                                </span>
                              </div>
                              <span className="text-gray-600 truncate">
                                {user.full_name || user.email}
                              </span>
                              <span className="text-gray-400 capitalize">({user.role})</span>
                            </div>
                          ))}
                          {agency.user_profiles.length > 3 && (
                            <p className="text-xs text-gray-500 ml-8">
                              +{agency.user_profiles.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => impersonateAgency(agency.id, agency.name)}
                        className="flex-1 flex items-center justify-center space-x-2"
                        size="sm"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Dashboard</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {agencies.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Agencies Found</h3>
                <p className="text-gray-600">
                  There are no agencies in the system yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  )
} 