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
    
    // Set a longer loading timeout for initial load to handle page refreshes
    const loadingTimeout = setTimeout(() => {
      debugLog('Auth loading timeout reached, forcing end of loading state')
      setLoading(false)
      // Only redirect to login if we're not already on the login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        router.push('/login')
      }
    }, 10000) // Increased to 10s to handle slower page refreshes

    // Get initial session with better error handling
    debugLog('Getting initial session...')
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      debugLog('Initial session result:', { hasSession: !!session, error })
      
      if (error) {
        debugLog('Session error, redirecting to login:', error)
        clearTimeout(loadingTimeout)
        setLoading(false)
        setUser(null)
        setProfile(null)
        setAgency(null)
        // Only redirect if not already on login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          router.push('/login')
        }
        return
      }
      
      if (session?.user) {
        debugLog('Setting user from session:', session.user.id)
        setUser(session.user)
        loadUserProfile(session.user.id).catch(err => {
          debugLog('Error loading profile:', err)
          clearTimeout(loadingTimeout)
          setLoading(false)
          setUser(null)
          setProfile(null)
          setAgency(null)
          // Only redirect if not already on login page
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            router.push('/login')
          }
        }).finally(() => {
          clearTimeout(loadingTimeout)
        })
      } else {
        debugLog('No session, setting loading false')
        clearTimeout(loadingTimeout)
        setLoading(false)
        setUser(null)
        setProfile(null)
        setAgency(null)
      }
    }).catch((error) => {
      debugLog('Error getting session:', error)
      clearTimeout(loadingTimeout)
      setLoading(false)
      setUser(null)
      setProfile(null)
      setAgency(null)
      // Only redirect if not already on login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        router.push('/login')
      }
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
          try {
            await loadUserProfile(session.user.id)
          } catch (err) {
            debugLog('Error loading profile after sign in:', err)
            setUser(null)
            setProfile(null)
            setAgency(null)
            setLoading(false)
            router.push('/login')
          }
        } else if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          debugLog('Sign out or token refresh failed, clearing state')
          setUser(null)
          setProfile(null)
          setAgency(null)
          setLoading(false)
          router.push('/login')
        } else if (event === 'TOKEN_REFRESHED' && session) {
          debugLog('Token refreshed successfully')
          if (session.user && !user) {
            setUser(session.user)
            try {
              await loadUserProfile(session.user.id)
            } catch (err) {
              debugLog('Error loading profile after token refresh:', err)
              setUser(null)
              setProfile(null)
              setAgency(null)
              setLoading(false)
              router.push('/login')
            }
          }
        }
        setLoading(false)
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
      // Create a longer timeout for profile loading
      const profileTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile loading timeout')), 5000) // Increased from 2s to 5s
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
        // Only redirect if not already on login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          router.push('/login')
        }
        throw timeoutError
      }

      if (result.error || !result.data) {
        debugLog('Profile error or not found - user not authorized:', result.error)
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setAgency(null)
        setLoading(false)
        // Only redirect if not already on login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          router.push('/login')
        }
        throw new Error('Profile not found or unauthorized')
      }

      debugLog('Successfully loaded profile, setting state')
      setProfile(result.data)
      setAgency(result.data.agencies || null)
      setLoading(false)

    } catch (error) {
      debugLog('Unexpected error in loadUserProfile:', error)
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setAgency(null)
      setLoading(false)
      // Only redirect if not already on login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        router.push('/login')
      }
      throw error
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