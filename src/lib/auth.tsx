import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, setRemember } from './supabase'
import { profileAction } from './actions'
import type { ProfileRow } from './types'
import { authReturn } from './invitation'

export type Profile = ProfileRow
type AuthValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: string
  loading: boolean
  profileError: string | null
  identityEpoch: number
  refresh: () => Promise<void>
  signInPassword: (email: string, password: string, remember?: boolean) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, displayName?: string, accountType?: 'member' | 'mentor') => Promise<{ error: string | null }>
  signInOAuth: (provider: 'google' | 'discord', remember?: boolean) => Promise<void>
  signOut: () => Promise<void>
}
const Ctx = createContext<AuthValue | null>(null)
export const useAuth = () => {
  const value = useContext(Ctx)
  if (!value) throw new Error('useAuth must be used within <AuthProvider>')
  return value
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [identityEpoch, setIdentityEpoch] = useState(0)
  const generation = useRef(0)
  const identity = useRef<string | null>(null)
  const mounted = useRef(true)
  const authority = useRef('')

  const loadProfile = useCallback(async (ticket: number) => {
    const { data, error } = await profileAction({ action: 'get_self' })
    if (!mounted.current || ticket !== generation.current) return
    if (error || !data) {
      authority.current = ''
      setProfile(null)
      setProfileError(error?.message ?? 'Your profile could not be loaded. Retry or sign in again.')
    } else {
      const nextAuthority = JSON.stringify([data.id,data.role,data.account_status,data.verified,data.permissions])
      if (authority.current && authority.current !== nextAuthority) setIdentityEpoch(epoch => epoch + 1)
      authority.current = nextAuthority
      setProfile({ ...data, verified: data.verified === true } as Profile)
      setProfileError(null)
    }
    setLoading(false)
  }, [])

  const acceptSession = useCallback((next: Session | null) => {
    const nextIdentity = next?.user.id ?? null
    const changed = identity.current !== nextIdentity
    identity.current = nextIdentity
    const ticket = ++generation.current
    setSession(next)
    if (changed || !next) setProfile(null)
    setProfileError(null)
    if (changed) {
      authority.current = ''
      setIdentityEpoch(epoch => epoch + 1)
      // These are user-specific UI choices, not durable domain state.
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('optix-scout-event')
        window.sessionStorage.removeItem('optix-scout-event')
      }
    }
    if (changed || !next) setLoading(!!next)
    // Do not await Supabase calls inside onAuthStateChange's internal auth lock.
    if (next) queueMicrotask(() => { void loadProfile(ticket) })
  }, [loadProfile])

  useEffect(() => {
    mounted.current = true
    let receivedEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      receivedEvent = true
      acceptSession(next)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted.current || receivedEvent) return
      if (error) { setLoading(false); setProfileError(error.message); return }
      acceptSession(data.session)
    })
    return () => { mounted.current = false; generation.current++; subscription.unsubscribe() }
  }, [acceptSession])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) { setProfile(null); setProfileError(error.message); setLoading(false); return }
    acceptSession(data.session)
  }, [acceptSession])

  useEffect(() => {
    if (!session) return
    const revalidate = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    const timer = window.setInterval(revalidate, 60_000)
    return () => { window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', revalidate); window.clearInterval(timer) }
  }, [session, refresh])

  const signInPassword = async (email: string, password: string, remember = true) => {
    setRemember(remember)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }
  const signUp = async (email: string, password: string, displayName?: string, accountType: 'member' | 'mentor' = 'member') => {
    const { error } = await supabase.auth.signUp({ email, password, options: {
      data: { display_name: displayName, account_type: accountType },
      emailRedirectTo: authReturn(),
    } })
    return { error: error?.message ?? null }
  }
  const signInOAuth = async (provider: 'google' | 'discord', remember = true) => {
    setRemember(remember)
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: authReturn() } })
    if (error) throw error
  }
  const signOut = async () => {
    acceptSession(null)
    const { error } = await supabase.auth.signOut()
    if (error) setProfileError(error.message)
  }
  return <Ctx.Provider value={{session,user:session?.user ?? null,profile,role:profile?.role ?? 'PENDING',loading,profileError,identityEpoch,refresh,signInPassword,signUp,signInOAuth,signOut}}>{children}</Ctx.Provider>
}
