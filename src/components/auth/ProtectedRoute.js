'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [redirectDelay, setRedirectDelay] = useState(false)

  useEffect(() => {
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
    if (user && !profile) {
      console.log('[ProtectedRoute] User exists but no profile yet, waiting...')
      
      // Start a delay timer
      const delayTimer = setTimeout(() => {
        console.log('[ProtectedRoute] Still no profile after delay, redirecting to login')
        router.push('/login')
      }, 3000) // Wait 3 seconds before redirecting

      // Clear the timer if component unmounts or profile loads
      return () => clearTimeout(delayTimer)
    }

    // If we have both user and profile, check admin requirements
    if (user && profile) {
      console.log('[ProtectedRoute] User and profile verified, access granted')
      
      if (requireAdmin && profile?.role !== 'admin') {
        console.log('[ProtectedRoute] Admin required but user is not admin, redirecting to dashboard')
        router.push('/dashboard')
        return
      }
    }
  }, [user, profile, loading, router, requireAdmin])

  // Show loading while auth is loading OR while we're waiting for profile
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {loading ? 'Loading...' : 'Loading profile...'}
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Account setup required. Redirecting...</p>
        </div>
      </div>
    )
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Admin access required. Redirecting...</p>
        </div>
      </div>
    )
  }

  return children
} 