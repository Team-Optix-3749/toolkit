import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(
  url && key && !url.includes('YOUR-PROJECT') && !key.includes('your-anon-key'),
)

// Safe to construct on the server; auth storage is only touched in the browser.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
