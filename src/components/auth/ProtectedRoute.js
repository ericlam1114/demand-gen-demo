'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
        return
      }
      
      // Additional security check: if user exists but no profile, they'll be handled by AuthProvider
      // This is a backup check in case the AuthProvider didn't catch it
      if (user && !profile) {
        console.log('[ProtectedRoute] User exists but no profile - redirecting to login')
        router.push('/login')
        return
      }
      
      if (requireAdmin && profile?.role !== 'admin') {
        router.push('/dashboard')
        return
      }
    }
  }, [user, profile, loading, router, requireAdmin])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
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