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
      console.log('[AuthProvider] TIMEOUT: Auth loading timeout after 10s, current state:', {
        hasUser: !!user,
        hasProfile: !!profile,
        hasAgency: !!agency,
        loading,
        currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
      })
      setLoading(false)
      // Only redirect to login if we're not already on the login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        debugLog('Redirecting to login due to timeout')
        router.push('/login')
      }
    }, 10000) // Increased to 10s to handle slower page refreshes

    // Get initial session with better error handling
    debugLog('Getting initial session...')
    console.log('[AuthProvider] Starting session check...')
    
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      debugLog('Initial session result:', { hasSession: !!session, error })
      console.log('[AuthProvider] Session check result:', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        error: error?.message || 'none',
        currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
      })
      
      if (error) {
        debugLog('Session error, redirecting to login:', error)
        console.log('[AuthProvider] Session error, clearing state and redirecting:', error.message)
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
        console.log('[AuthProvider] Valid session found, loading profile for user:', session.user.id)
        setUser(session.user)
        loadUserProfile(session.user.id).catch(err => {
          debugLog('Error loading profile:', err)
          console.log('[AuthProvider] Profile loading failed:', err.message)
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
        console.log('[AuthProvider] No session found, clearing state')
        clearTimeout(loadingTimeout)
        setLoading(false)
        setUser(null)
        setProfile(null)
        setAgency(null)
      }
    }).catch((error) => {
      debugLog('Error getting session:', error)
      console.log('[AuthProvider] Exception during session check:', error.message)
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
        console.log('[AuthProvider] Auth state change event:', {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
          currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
        })
        clearTimeout(loadingTimeout)
        
        if (event === 'SIGNED_IN' && session?.user) {
          debugLog('Sign in detected, loading profile for:', session.user.id)
          console.log('[AuthProvider] SIGNED_IN event, loading profile')
          setUser(session.user)
          try {
            await loadUserProfile(session.user.id)
          } catch (err) {
            debugLog('Error loading profile after sign in:', err)
            console.log('[AuthProvider] Profile loading failed after sign in:', err.message)
            setUser(null)
            setProfile(null)
            setAgency(null)
            setLoading(false)
            router.push('/login')
          }
        } else if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          debugLog('Sign out or token refresh failed, clearing state')
          console.log('[AuthProvider] SIGNED_OUT or failed TOKEN_REFRESH, clearing state')
          setUser(null)
          setProfile(null)
          setAgency(null)
          setLoading(false)
          router.push('/login')
        } else if (event === 'TOKEN_REFRESHED' && session) {
          debugLog('Token refreshed successfully')
          console.log('[AuthProvider] TOKEN_REFRESHED successfully')
          if (session.user && !user) {
            setUser(session.user)
            try {
              await loadUserProfile(session.user.id)
            } catch (err) {
              debugLog('Error loading profile after token refresh:', err)
              console.log('[AuthProvider] Profile loading failed after token refresh:', err.message)
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
    console.log('[AuthProvider] Loading user profile for:', userId)
    
    try {
      // Create a longer timeout for profile loading
      const profileTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile loading timeout')), 5000) // Increased from 2s to 5s
      )

      // Try to get user profile with a timeout
      debugLog('Querying user profile...')
      console.log('[AuthProvider] Executing profile query...')
      
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
        console.log('[AuthProvider] Profile query result:', { 
          hasData: !!result.data, 
          error: result.error?.message || 'none',
          profileId: result.data?.id,
          agencyId: result.data?.agency_id,
          agencyName: result.data?.agencies?.name
        })
      } catch (timeoutError) {
        debugLog('Profile loading timed out, signing out user')
        console.log('[AuthProvider] Profile loading timed out after 5s')
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
        console.log('[AuthProvider] Profile not found or access denied:', result.error?.message || 'no data')
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
      console.log('[AuthProvider] Profile loaded successfully, setting auth state')
      setProfile(result.data)
      setAgency(result.data.agencies || null)
      setLoading(false)

    } catch (error) {
      debugLog('Unexpected error in loadUserProfile:', error)
      console.log('[AuthProvider] Unexpected error loading profile:', error.message)
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