'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [agency, setAgency] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Debug logging
  const debugLog = (message, data = null) => {
    console.log(`[AuthProvider] ${message}`, data)
  }

  // Clear any potentially cached demo data on mount
  useEffect(() => {
    // Clear any localStorage or sessionStorage that might contain demo data
    if (typeof window !== 'undefined') {
      // Remove any potential demo data from storage
      localStorage.removeItem('demo-profile')
      localStorage.removeItem('demo-agency')
      sessionStorage.removeItem('demo-profile')
      sessionStorage.removeItem('demo-agency')
    }
  }, [])

  useEffect(() => {
    debugLog('AuthProvider useEffect starting')
    
    // Set a maximum loading time to prevent infinite hanging
    const loadingTimeout = setTimeout(() => {
      debugLog('Auth loading timeout reached, forcing end of loading state')
      setLoading(false)
      // If still loading after timeout, redirect to login
      router.push('/login')
    }, 8000) // 8 second timeout

    // Get initial session with better error handling
    debugLog('Getting initial session...')
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      debugLog('Initial session result:', { hasSession: !!session, error })
      
      if (error) {
        debugLog('Session error, redirecting to login:', error)
        clearTimeout(loadingTimeout)
        setLoading(false)
        router.push('/login')
        return
      }
      
      if (session?.user) {
        debugLog('Setting user from session:', session.user.id)
        setUser(session.user)
        loadUserProfile(session.user.id).finally(() => {
          clearTimeout(loadingTimeout)
        })
      } else {
        debugLog('No session, setting loading false')
        clearTimeout(loadingTimeout)
        setLoading(false)
      }
    }).catch((error) => {
      debugLog('Error getting session:', error)
      clearTimeout(loadingTimeout)
      setLoading(false)
      router.push('/login')
    })

    // Listen for auth changes with improved handling
    debugLog('Setting up auth state change listener')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog('Auth state change:', { event, sessionExists: !!session })
        clearTimeout(loadingTimeout)
        
        if (event === 'SIGNED_IN' && session?.user) {
          debugLog('Sign in detected, loading profile for:', session.user.id)
          setUser(session.user)
          await loadUserProfile(session.user.id)
        } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
          debugLog('Sign out or token refresh failed, clearing state')
          // Immediately clear all state - no demo data should ever appear
          setUser(null)
          setProfile(null)
          setAgency(null)
          setLoading(false)
          router.push('/login')
        } else if (event === 'TOKEN_REFRESHED' && session) {
          debugLog('Token refreshed successfully')
          // Token was refreshed, ensure user is still valid
          if (session.user && !user) {
            setUser(session.user)
            await loadUserProfile(session.user.id)
          }
        } else {
          debugLog('Other auth event, setting loading false')
          setLoading(false)
        }
      }
    )

    return () => {
      debugLog('Cleaning up auth provider')
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [router])

  const loadUserProfile = async (userId) => {
    debugLog('loadUserProfile called for:', userId)
    
    try {
      // Create a timeout promise that rejects after 4 seconds
      const profileTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile loading timeout')), 4000)
      )

      // Try to get user profile with a timeout
      debugLog('Querying user profile...')
      const profileQuery = supabase
        .from('user_profiles')
        .select(`
          *,
          agencies (
            id,
            name,
            slug,
            plan,
            max_users,
            max_letters_per_month,
            logo_url
          )
        `)
        .eq('id', userId)
        .single()

      let result

      try {
        result = await Promise.race([profileQuery, profileTimeout])
        debugLog('Profile query completed:', { hasData: !!result.data, error: result.error })
      } catch (timeoutError) {
        debugLog('Profile loading timed out, signing out user')
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setAgency(null)
        setLoading(false)
        router.push('/login')
        return
      }

      if (result.error || !result.data) {
        debugLog('Profile error or not found - user not authorized:', result.error)
        
        // Security: Users without proper profiles should not get access
        // Sign them out and redirect to login
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setAgency(null)
        setLoading(false)
        router.push('/login')
        return
      }

      debugLog('Successfully loaded profile, setting state')
      setProfile(result.data)
      setAgency(result.data.agencies || null)
      setLoading(false)

    } catch (error) {
      debugLog('Unexpected error in loadUserProfile:', error)
      
      // Security: On any error, sign out the user instead of giving demo access
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setAgency(null)
      setLoading(false)
      router.push('/login')
    }
  }

  const signIn = async (email, password) => {
    debugLog('signIn called for:', email)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      debugLog('SignIn result:', { hasData: !!data, error })
      return { data, error }
    } catch (err) {
      debugLog('SignIn exception:', err)
      return { data: null, error: err }
    }
  }

  const signUp = async (email, password, metadata = {}) => {
    debugLog('signUp called for:', email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    debugLog('SignUp result:', { hasData: !!data, error })
    return { data, error }
  }

  const signOut = async () => {
    debugLog('signOut called')
    
    // Clear all state immediately
    setUser(null)
    setProfile(null)
    setAgency(null)
    setLoading(false)
    
    // Clear any browser storage
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
    }
    
    const { error } = await supabase.auth.signOut()
    debugLog('SignOut result:', { error })
    
    // Force redirect to login
    router.push('/login')
    
    return { error }
  }

  const isAdmin = () => profile?.role === 'admin'
  const isManager = () => ['admin', 'manager'].includes(profile?.role)
  const canManageTeam = () => isManager()
  const canDeleteContent = () => isManager()

  // Add debug info to the context value
  const value = {
    user,
    profile,
    agency,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isManager,
    canManageTeam,
    canDeleteContent,
    loadUserProfile,
    // Debug info
    _debug: {
      hasUser: !!user,
      hasProfile: !!profile,
      hasAgency: !!agency,
      loading
    }
  }

  debugLog('AuthProvider render', { 
    hasUser: !!user, 
    hasProfile: !!profile, 
    hasAgency: !!agency, 
    loading 
  })

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 