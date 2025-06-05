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

  useEffect(() => {
    debugLog('AuthProvider useEffect starting')
    
    // Set a maximum loading time to prevent infinite hanging
    const loadingTimeout = setTimeout(() => {
      debugLog('Auth loading timeout reached, forcing end of loading state')
      setLoading(false)
    }, 10000) // 10 second timeout

    // Get initial session
    debugLog('Getting initial session...')
    supabase.auth.getSession().then(({ data: { session } }) => {
      debugLog('Initial session result:', session ? 'Session found' : 'No session')
      
      if (session?.user) {
        debugLog('Setting user from session:', session.user.id)
        setUser(session.user)
        loadUserProfile(session.user.id)
      } else {
        debugLog('No session, setting loading false')
        clearTimeout(loadingTimeout)
        setLoading(false)
      }
    }).catch((error) => {
      debugLog('Error getting session:', error)
      clearTimeout(loadingTimeout)
      setLoading(false)
    })

    // Listen for auth changes
    debugLog('Setting up auth state change listener')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog('Auth state change:', { event, sessionExists: !!session })
        clearTimeout(loadingTimeout)
        
        if (event === 'SIGNED_IN' && session?.user) {
          debugLog('Sign in detected, loading profile for:', session.user.id)
          setUser(session.user)
          await loadUserProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          debugLog('Sign out detected')
          setUser(null)
          setProfile(null)
          setAgency(null)
          setLoading(false)
          router.push('/login')
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
      // Create a simple timeout for profile loading
      const profileTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile loading timeout')), 5000)
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

      let profileData, profileError

      try {
        const result = await Promise.race([profileQuery, profileTimeout])
        profileData = result.data
        profileError = result.error
        debugLog('Profile query completed:', { hasData: !!profileData, error: profileError })
      } catch (timeoutError) {
        debugLog('Profile loading timed out, using fallback')
        profileError = { code: 'TIMEOUT' }
      }

      if (profileError || !profileData) {
        debugLog('Profile error or not found, creating fallback profile...')
        
        // Create a fallback profile immediately
        const fallbackProfile = {
          id: userId,
          email: user?.email || 'demo@example.com',
          full_name: user?.user_metadata?.full_name || user?.email || 'Demo User',
          role: 'user',
          agency_id: null,
          agencies: {
            id: 'demo-agency',
            name: 'Demo Agency',
            slug: 'demo',
            plan: 'free',
            max_users: 1,
            max_letters_per_month: 50,
            logo_url: null
          }
        }
        
        debugLog('Using fallback profile:', fallbackProfile)
        setProfile(fallbackProfile)
        setAgency(fallbackProfile.agencies)
        setLoading(false)
        return
      }

      debugLog('Successfully loaded profile, setting state')
      setProfile(profileData)
      setAgency(profileData.agencies || null)
      setLoading(false)

    } catch (error) {
      debugLog('Unexpected error in loadUserProfile:', error)
      
      // Always create a fallback profile on any error
      const fallbackProfile = {
        id: userId,
        email: 'demo@example.com',
        full_name: 'Demo User',
        role: 'user',
        agency_id: null,
        agencies: {
          id: 'demo-agency',
          name: 'Demo Agency',
          slug: 'demo',
          plan: 'free',
          max_users: 1,
          max_letters_per_month: 50,
          logo_url: null
        }
      }
      
      debugLog('Using error fallback profile')
      setProfile(fallbackProfile)
      setAgency(fallbackProfile.agencies)
      setLoading(false)
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
    const { error } = await supabase.auth.signOut()
    debugLog('SignOut result:', { error })
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