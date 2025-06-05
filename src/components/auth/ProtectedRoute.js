// src/components/auth/ProtectedRoute.js
'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Don't do anything while loading
    if (loading) return

    // Check authentication
    if (!user) {
      console.log('[ProtectedRoute] No user, redirecting to login')
      router.push('/login')
      return
    }

    // Check admin requirement
    if (requireAdmin && profile?.role !== 'admin') {
      console.log('[ProtectedRoute] Admin required but user is not admin')
      router.push('/dashboard')
      return
    }
  }, [user, profile, loading, requireAdmin, router])

  // Show loading state
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

  // Show redirecting state if no user
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  // Render children if authenticated
  return children
}