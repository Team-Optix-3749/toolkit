import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, setRemember } from './supabase'

export type Profile = {
  id: string
  role: string
  display_name: string | null
  avatar_url: string | null
  grade: string | null
  bio: string | null
  department: string | null
  special_perms: string[] | null
}

type AuthValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: string
  loading: boolean
  refresh: () => Promise<void>
  signInPassword: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error: string | null }>
  signInOAuth: (provider: 'google' | 'discord', remember?: boolean) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)
export const useAuth = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within <AuthProvider>')
  return v
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const ensureProfile = useCallback(async (user: User) => {
    let { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (!data) {
      const meta = user.user_metadata ?? {}
      const name =
        meta.display_name || meta.full_name || meta.name || (user.email || 'member').split('@')[0]
      await supabase.from('profiles').insert({ id: user.id, display_name: name })
      ;({ data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle())
    }
    setProfile((data as Profile) ?? null)
  }, [])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    if (data.session?.user) await ensureProfile(data.session.user)
    else setProfile(null)
  }, [ensureProfile])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session?.user) await ensureProfile(data.session.user)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!active) return
      setSession(s)
      if (s?.user) await ensureProfile(s.user)
      else setProfile(null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [ensureProfile])

  const value: AuthValue = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? 'PENDING',
    loading,
    refresh,
    async signInPassword(email, password, remember = true) {
      setRemember(remember)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
    },
    async signUp(email, password, displayName) {
      const name = displayName?.trim()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: name ? { data: { display_name: name } } : undefined,
      })
      return { error: error?.message ?? null }
    },
    async signInOAuth(provider, remember = true) {
      setRemember(remember)
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
        },
      })
    },
    async signOut() {
      await supabase.auth.signOut()
      setProfile(null)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
