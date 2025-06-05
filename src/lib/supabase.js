import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Client-side Supabase client with proper auth configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: {
      // Use a custom storage that works with Next.js
      getItem: (key) => {
        if (typeof window === 'undefined') {
          return null
        }
        return window.localStorage.getItem(key)
      },
      setItem: (key, value) => {
        if (typeof window === 'undefined') {
          return
        }
        window.localStorage.setItem(key, value)
      },
      removeItem: (key) => {
        if (typeof window === 'undefined') {
          return
        }
        window.localStorage.removeItem(key)
      }
    }
  }
})

// Server-side client with service role key for Edge Functions
export const createServerClient = () => {
  return createClient(
    process.env.SUPABASE_URL || supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
    {
      auth: {
        persistSession: false, // No session persistence on server
        autoRefreshToken: false
      }
    }
  )
}