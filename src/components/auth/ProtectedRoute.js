'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [redirectDelay, setRedirectDelay] = useState(false)

  useEffect(() => {
    // Don't run protection logic on login page
    if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
      return
    }

    // Don't do anything while auth is loading
    if (loading) {
      return
    }

    // If no user at all, redirect immediately
    if (!user) {
      console.log('[ProtectedRoute] No user found, redirecting to login')
      router.push('/login')
      return
    }

    // If we have a user but no profile, wait a bit longer before redirecting
    // This gives AuthProvider more time to load the profile
    if (user && !profile && !redirectDelay) {
      console.log('[ProtectedRoute] User exists but no profile, waiting for profile to load...')
      setRedirectDelay(true)
      
      const delayTimeout = setTimeout(() => {
        if (!profile) {
          console.log('[ProtectedRoute] Profile loading timeout, redirecting to login')
          router.push('/login')
        }
      }, 2000) // Reduced timeout since AuthProvider has longer timeouts now
      
      return () => clearTimeout(delayTimeout)
    }

    // Check admin requirement
    if (requireAdmin && profile && profile.role !== 'admin') {
      console.log('[ProtectedRoute] Admin required but user is not admin')
      router.push('/dashboard')
      return
    }

  }, [user, profile, loading, requireAdmin, router, redirectDelay])

  // Don't show loading on login page
  if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
    return children
  }

  // Show loading while auth is being determined
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  }

  // Show loading while waiting for profile
  if (user && !profile && redirectDelay) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading profile...</p>
      </div>
    </div>
  }

  // Show content if authenticated and authorized
  if (user && profile) {
    return children
  }

  // Fallback loading state
  return <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Authenticating...</p>
    </div>
  </div>
} 