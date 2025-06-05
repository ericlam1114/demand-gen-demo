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
    
    // Simple loading timeout - much shorter and simpler
    const loadingTimeout = setTimeout(() => {
      debugLog('Auth loading timeout - setting loading to false')
      setLoading(false)
    }, 5000) // Just 5 seconds, no complex logic

    // Get initial session
    debugLog('Getting initial session...')
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      debugLog('Initial session result:', { hasSession: !!session, error })
      
      if (error) {
        debugLog('Session error:', error)
        clearTimeout(loadingTimeout)
        setLoading(false)
        setUser(null)
        setProfile(null)
        setAgency(null)
        return
      }
      
      if (session?.user) {
        debugLog('Setting user from session:', session.user.id)
        setUser(session.user)
        loadUserProfile(session.user.id).finally(() => {
          clearTimeout(loadingTimeout)
          setLoading(false)
        })
      } else {
        debugLog('No session found')
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
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog('Auth state change:', { event, sessionExists: !!session })
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await loadUserProfile(session.user.id)
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setAgency(null)
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
          if (!profile) {
            await loadUserProfile(session.user.id)
          }
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [router])

  const loadUserProfile = async (userId) => {
    debugLog('loadUserProfile called for:', userId)
    
    try {
      const { data, error } = await supabase
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

      if (error || !data) {
        debugLog('Profile error or not found:', error)
        setUser(null)
        setProfile(null)
        setAgency(null)
        return
      }

      debugLog('Profile loaded successfully')
      setProfile(data)
      setAgency(data.agencies || null)

    } catch (error) {
      debugLog('Error in loadUserProfile:', error)
      setUser(null)
      setProfile(null)
      setAgency(null)
    }
  }

  // Add this updated signIn method to your AuthProvider

const signIn = async (email, password) => {
  debugLog('signIn called for:', email)
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    debugLog('SignIn result:', { hasData: !!data, error })
    
    if (error) {
      return { data, error }
    }
    
    // If sign in was successful, wait a bit for the auth state change
    // to be processed by the onAuthStateChange listener
    if (data?.user) {
      debugLog('Sign in successful, user:', data.user.id)
      
      // Give the auth state change listener time to process
      // This helps ensure the profile starts loading
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
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