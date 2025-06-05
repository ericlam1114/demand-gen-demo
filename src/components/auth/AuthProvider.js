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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await loadUserProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setAgency(null)
          router.push('/login')
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  const loadUserProfile = async (userId) => {
    try {
      console.log('Loading user profile for userId:', userId)
      
      // Get user profile with agency info
      const { data: profileData, error: profileError } = await supabase
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

      console.log('Profile query result:', { profileData, profileError })

      if (profileError) {
        console.error('Error loading profile:', profileError)
        
        // If profile doesn't exist, create a simple temporary one and continue
        if (profileError.code === 'PGRST116') {
          console.log('Profile not found, creating temporary profile for demo...')
          
          // Get user info from auth
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          
          if (user && !userError) {
            // Create a simple profile without agency for now
            const tempProfile = {
              id: userId,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.email,
              role: 'user',
              agency_id: null,
              agencies: null
            }
            
            console.log('Using temporary profile:', tempProfile)
            setProfile(tempProfile)
            setAgency(null)
            
            // Don't redirect to onboarding, let them use the app
            setLoading(false)
            return
          }
        }
        
        // For other errors, create a basic profile and continue
        console.log('Creating basic profile for demo purposes...')
        const basicProfile = {
          id: userId,
          email: 'demo@example.com',
          full_name: 'Demo User',
          role: 'user',
          agency_id: null,
          agencies: null
        }
        
        setProfile(basicProfile)
        setAgency(null)
        setLoading(false)
        return
      }

      console.log('Successfully loaded profile:', profileData)
      setProfile(profileData)
      setAgency(profileData.agencies)

      // Update last login (don't await this, let it happen in background)
      supabase
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId)
        .then(({ error }) => {
          if (error) console.log('Failed to update last login:', error)
        })

      setLoading(false)

    } catch (error) {
      console.error('Unexpected error in loadUserProfile:', error)
      
      // Create a fallback profile so the app doesn't crash
      const fallbackProfile = {
        id: userId,
        email: 'demo@example.com',
        full_name: 'Demo User',
        role: 'user',
        agency_id: null,
        agencies: null
      }
      
      setProfile(fallbackProfile)
      setAgency(null)
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
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