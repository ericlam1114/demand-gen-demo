'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [profileWaitStarted, setProfileWaitStarted] = useState(false)

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

    // If we have a user but no profile, wait a short time before redirecting
    if (user && !profile) {
      if (!profileWaitStarted) {
        console.log('[ProtectedRoute] User exists but no profile, starting wait timer...')
        setProfileWaitStarted(true)
        
        const delayTimeout = setTimeout(() => {
          console.log('[ProtectedRoute] Profile wait timeout, redirecting to login')
          router.push('/login')
        }, 3000) // 3 second wait
        
        return () => {
          clearTimeout(delayTimeout)
          setProfileWaitStarted(false)
        }
      }
      return // Keep waiting while profile loads
    }

    // Reset wait state if we have a profile now
    if (user && profile && profileWaitStarted) {
      console.log('[ProtectedRoute] Profile loaded successfully')
      setProfileWaitStarted(false)
    }

    // Check admin requirement
    if (requireAdmin && profile && profile.role !== 'admin') {
      console.log('[ProtectedRoute] Admin required but user is not admin')
      router.push('/dashboard')
      return
    }

  }, [user, profile, loading, requireAdmin, router, profileWaitStarted])

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

  // Show loading while waiting for profile (but only if we have a user)
  if (user && !profile) {
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

  // Fallback - this should not normally be reached
  console.log('[ProtectedRoute] Fallback state reached - redirecting to login')
  router.push('/login')
  return <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Redirecting...</p>
    </div>
  </div>
} 