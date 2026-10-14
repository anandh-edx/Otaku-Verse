import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isStaff: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}
const Ctx = createContext<AuthState>(null as unknown as AuthState)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string) => {
    let { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (!data) {
      // Profile creation retry path: the DB trigger may have failed/lagged; ensure_profile is idempotent.
      await supabase.rpc('ensure_profile')
      ;({ data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle())
    }
    setProfile((data as Profile) ?? null)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) setTimeout(() => loadProfile(s.user.id), 0) // avoid deadlock inside auth callback
      else setProfile(null)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  // last-active heartbeat (own row; guarded by DB trigger for protected fields)
  useEffect(() => {
    if (!session) return
    const beat = () => supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', session.user.id).then(() => {})
    beat()
    const t = setInterval(beat, 120_000)
    return () => clearInterval(t)
  }, [session])

  const value: AuthState = {
    session, profile, loading,
    isStaff: profile?.role === 'moderator' || profile?.role === 'admin',
    isAdmin: profile?.role === 'admin',
    refreshProfile: async () => { if (session) await loadProfile(session.user.id) },
    signOut: async () => { await supabase.auth.signOut(); setProfile(null) },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
