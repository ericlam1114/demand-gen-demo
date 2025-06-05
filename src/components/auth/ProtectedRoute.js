'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Don't do anything while loading
    if (loading) {
      return
    }

    // Skip protection on login page
    if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
      return
    }

    // After loading is complete, check authentication
    if (!loading && !user) {
      console.log('[ProtectedRoute] No user after loading, redirecting to login')
      router.push('/login')
      return
    }

    // User exists but profile failed to load
    if (!loading && user && !profile) {
      console.log('[ProtectedRoute] User exists but no profile, redirecting to login')
      router.push('/login')
      return
    }

    // Check admin requirement
    if (!loading && requireAdmin && profile?.role !== 'admin') {
      console.log('[ProtectedRoute] Admin required but user is not admin, redirecting to dashboard')
      router.push('/dashboard')
      return
    }

  }, [user, profile, loading, requireAdmin, router])

  // Show login page content regardless of auth state
  if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
    return children
  }

  // ALWAYS show loading while AuthProvider is loading
  // This prevents any redirects during the initial auth check
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // After loading is complete, check if authenticated
  if (!loading && user && profile) {
    return children
  }

  // If we get here, we're not loading but also not authenticated
  // The useEffect will handle the redirect
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}