'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Skip protection on login page
    if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
      return
    }

    // Wait for loading to complete
    if (loading) {
      return
    }

    // No user = redirect to login
    if (!user) {
      router.push('/login')
      return
    }

    // User but no profile = redirect to login (profile failed to load)
    if (user && !profile) {
      router.push('/login')
      return
    }

    // Check admin requirement
    if (requireAdmin && profile?.role !== 'admin') {
      router.push('/dashboard')
      return
    }

  }, [user, profile, loading, requireAdmin, router])

  // Show login page content regardless of auth state
  if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
    return children
  }

  // Show loading while AuthProvider is loading
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  }

  // Show content only if fully authenticated
  if (user && profile) {
    return children
  }

  // Fallback loading (should redirect soon)
  return <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Redirecting...</p>
    </div>
  </div>
} 