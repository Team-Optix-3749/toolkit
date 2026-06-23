import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(
  url && key && !url.includes('YOUR-PROJECT') && !key.includes('your-anon-key'),
)

// "Remember me" persistence.
// When remembered (default) the auth session lives in localStorage and survives a
// browser restart. When not remembered it lives in sessionStorage and is dropped
// when the tab/browser closes. The flag itself always lives in localStorage so the
// choice is recalled on the next visit.
const REMEMBER_KEY = 'optix.remember'

export function isRemembered(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(REMEMBER_KEY) !== '0'
}

export function setRemember(value: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(REMEMBER_KEY, value ? '1' : '0')
}

// Storage adapter that routes session reads/writes to the right backend based on
// the current "remember me" choice, and keeps the two backends from diverging.
const hybridStorage = {
  getItem(k: string): string | null {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(k) ?? window.sessionStorage.getItem(k)
  },
  setItem(k: string, v: string) {
    if (typeof window === 'undefined') return
    if (isRemembered()) {
      window.localStorage.setItem(k, v)
      window.sessionStorage.removeItem(k)
    } else {
      window.sessionStorage.setItem(k, v)
      window.localStorage.removeItem(k)
    }
  },
  removeItem(k: string) {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(k)
    window.sessionStorage.removeItem(k)
  },
}

// Safe to construct on the server; auth storage is only touched in the browser.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window === 'undefined' ? undefined : hybridStorage,
  },
})
