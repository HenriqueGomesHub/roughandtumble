import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { calibrateServerTime } from '../../lib/time'
import type { Profile } from '../../types'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  isAdminUnlocked: boolean
  setAdminUnlocked: (v: boolean) => void
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdminUnlocked, setAdminUnlocked] = useState(false)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      setProfile(data as Profile | null)
    } catch (err) {
      console.error('[AuthProvider] profile fetch failed:', err)
    }
  }, [])

  // Re-fetches from the current session — called after profile mutations.
  const reloadProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await fetchProfile(session.user.id)
  }, [fetchProfile])

  useEffect(() => {
    calibrateServerTime() // fire-and-forget; populates module-level offset for countdown math

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setUser(session?.user ?? null)
        if (session?.user) await fetchProfile(session.user.id)
      })
      .catch((err) => console.error('[AuthProvider] getSession failed:', err))
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        if (event === 'SIGNED_OUT') setAdminUnlocked(false)
      },
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, isAdminUnlocked, setAdminUnlocked, reloadProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
