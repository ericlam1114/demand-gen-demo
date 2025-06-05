// src/components/auth/AuthProvider.js
'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

  // Make loadUserProfile stable with useCallback
  const loadUserProfile = useCallback(async (userId) => {
    console.log('[AuthProvider] loadUserProfile called for:', userId)
    
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
        console.log('[AuthProvider] Profile error or not found:', error)
        // Don't clear user here - let them stay logged in
        setProfile(null)
        setAgency(null)
        // Redirect to onboarding if no profile exists
        if (error?.code === 'PGRST116') {
          router.push('/onboarding')
        }
        return
      }

      console.log('[AuthProvider] Profile loaded successfully')
      setProfile(data)
      setAgency(data.agencies || null)

    } catch (error) {
      console.error('[AuthProvider] Error in loadUserProfile:', error)
      setProfile(null)
      setAgency(null)
    }
  }, [router])

  useEffect(() => {
    let mounted = true
    console.log('[AuthProvider] useEffect starting')
    
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[AuthProvider] Session error:', error)
          if (mounted) {
            setUser(null)
            setProfile(null)
            setAgency(null)
            setLoading(false)
          }
          return
        }
        
        if (session?.user && mounted) {
          console.log('[AuthProvider] Setting user from session:', session.user.id)
          setUser(session.user)
          await loadUserProfile(session.user.id)
        }
        
        if (mounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('[AuthProvider] Error initializing auth:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state change:', { event, sessionExists: !!session })
        
        if (!mounted) return
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await loadUserProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setAgency(null)
          router.push('/login')
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
          // Don't reload profile on token refresh unless needed
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadUserProfile, router])

  const signIn = async (email, password) => {
    console.log('[AuthProvider] signIn called for:', email)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      console.log('[AuthProvider] SignIn result:', { hasData: !!data, error })
      
      if (error) {
        return { data, error }
      }
      
      // The auth state change listener will handle the rest
      return { data, error }
    } catch (err) {
      console.error('[AuthProvider] SignIn exception:', err)
      return { data: null, error: err }
    }
  }

  const signUp = async (email, password, metadata = {}) => {
    console.log('[AuthProvider] signUp called for:', email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    console.log('[AuthProvider] SignUp result:', { hasData: !!data, error })
    return { data, error }
  }

  const signOut = async () => {
    console.log('[AuthProvider] signOut called')
    
    const { error } = await supabase.auth.signOut()
    console.log('[AuthProvider] SignOut result:', { error })
    
    // The auth state change listener will handle cleanup
    return { error }
  }

  const isAdmin = () => profile?.role === 'admin'
  const isManager = () => ['admin', 'manager'].includes(profile?.role)
  const canManageTeam = () => isManager()
  const canDeleteContent = () => isManager()

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
    loadUserProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}