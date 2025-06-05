'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Sidebar } from './sidebar'
import { Button } from '@/components/ui/button'
import { Menu, Bell, User, Settings, LogOut, Building2, Users, Eye, Crown } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

export function AppLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [impersonationContext, setImpersonationContext] = useState(null)
  const { user, profile, agency, isAdmin } = useAuth()

  useEffect(() => {
    // Check for impersonation context
    if (typeof window !== 'undefined') {
      const context = sessionStorage.getItem('admin_impersonating')
      if (context) {
        setImpersonationContext(JSON.parse(context))
      }
    }
  }, [])

  const stopImpersonation = () => {
    sessionStorage.removeItem('admin_impersonating')
    setImpersonationContext(null)
    window.location.href = '/admin' // Full page reload to reset context
  }

  const handleSignOut = async () => {
    console.log('[AppLayout] Sign out button clicked')
    setShowUserMenu(false) // Close the menu immediately
    
    try {
      // Clear any local storage first
      if (typeof window !== 'undefined') {
        console.log('[AppLayout] Clearing local storage...')
        // Clear Supabase auth storage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key)
          }
        })
      }
      
      console.log('[AppLayout] Calling supabase signOut...')
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('[AppLayout] Supabase sign out error:', error)
        toast.error(`Sign out failed: ${error.message}`)
      } else {
        console.log('[AppLayout] Sign out successful')
        toast.success('Signed out successfully')
      }
      
      // Always redirect regardless of result
      console.log('[AppLayout] Redirecting to login...')
      setTimeout(() => {
        window.location.href = '/login'
      }, 500)
      
    } catch (err) {
      console.error('[AppLayout] Sign out exception:', err)
      toast.error('Sign out failed - redirecting anyway')
      
      // Force redirect even on error
      setTimeout(() => {
        window.location.href = '/login'
      }, 1000)
    }
  }

  // Show impersonated agency name if applicable
  const displayAgencyName = impersonationContext ? impersonationContext.agencyName : (agency?.name || 'Loading...')

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Impersonation Banner */}
      {impersonationContext && isAdmin() && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-100 border-b border-yellow-300 z-50 px-4 py-2">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-yellow-600" />
              <Crown className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Admin View: You are viewing <strong>{impersonationContext.agencyName}</strong> dashboard
              </span>
            </div>
            <Button
              onClick={stopImpersonation}
              size="sm"
              variant="outline"
              className="border-yellow-400 text-yellow-700 hover:bg-yellow-200"
            >
              Return to Admin Panel
            </Button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} />
      
      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 ${impersonationContext && isAdmin() ? 'mt-12' : ''}`}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">{displayAgencyName}</span>
              {agency?.plan && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {agency.plan}
                </span>
              )}
              {impersonationContext && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  Admin View
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Admin Panel Link */}
            {isAdmin() && (
              <Link
                href="/admin"
                className="flex items-center space-x-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Admin Panel</span>
              </Link>
            )}

            {/* Notifications */}
            {/* <Button variant="ghost" size="sm">
              <Bell className="w-5 h-5 text-gray-600" />
            </Button> */}

            {/* User Menu */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {profile?.full_name || user?.email}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {profile?.role || 'User'}
                  </div>
                </div>
              </Button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <Link
                      href="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Settings className="w-4 h-4 mr-3" />
                      Settings
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleSignOut()
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Overlay for mobile menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  )
} 